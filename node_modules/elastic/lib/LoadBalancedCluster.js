var ec2 = require( './Ec2Client' );
var ScalingManager = require( './ScalingManager.js' );
var async = require( 'async' );

var POLL_TIME = 300000;

function LoadBalancedCluster( config ) {
	this.config = config;
	this.scalingManager = new ScalingManager( this );
}
LoadBalancedCluster.prototype.setLogger = function( logger ) {
	this.logger = logger;
	this.scalingManager.setLogger( logger );
}
LoadBalancedCluster.prototype.start = function( callback ) {
	this.logger.log( 'elastic (' + this.config.name + '): Starting cluster.' );
	var self = this;
	async.series( [
			function( done ) {
				self.logger.log( 'elastic (' + self.config.name + '): Checking for Security Group.' );
				self._ensureSecurityGroupExists( done );
			},
			function( done ) {
				self.logger.log( 'elastic (' + self.config.name + '): Checking for load balancer.' );
				self._ensureLoadBalancerExists( done );
			},
			function( done ) {
				self.logger.log( 'elastic (' + self.config.name + '): Checking for first node.')
				self._ensureFirstNodeExists( done );
			},
			function( done ) {
				self.logger.log( 'elastic (' + self.config.name + '): Making sure existing nodes are connected to load balancer.')
				self._ensureExistingNodesAreConnected( done );
			},
		], function( err, results ) {
			if( err )
			{
				self.logger.log( '*** ERROR: ' + err );
				callback( err, null );
			}
			else
			{
				self.logger.log( 'elastic (' + self.config.name + '): Done building cluster.' );

				function pollForUtilization() {
					ec2.getBalancedInstances( 
						self.config.region, self.config.name, 
						function( error, instances ) {
							if( error )
							{
								self.logger.log( error );
								setTimeout( pollForUtilization, POLL_TIME );
							}
							else
							{
								var count = 0;
								var sum = 0;
								async.forEachSeries( instances, 
									function( instance, done ) {
										if( instance.state == 'InService' )
										{
											ec2.getAverageCPUUtilization( 
												self.config.region, instance.instance,
												function( error, percent ) {
													if( error )
														done();
													else
													{
														count++;
														sum += percent;
														done();
													}
												} );
										}
										else
											done();
									}, 
									function( error ) {
										if( error )
											self.logger.log( error );
										
										if( count > 0 )
										{
											self.scalingManager.reportUtilization( sum / count, count, function( error ) {
												setTimeout( pollForUtilization, POLL_TIME );
											} );
										}
										else
											self._launchNewNode( function( error ) {
												setTimeout( pollForUtilization, POLL_TIME );
											});

									});
							}
						} );

				};
				setTimeout( pollForUtilization, 1000 );
				callback( null, self.externalDns );
			}
		} 
	);
}

LoadBalancedCluster.prototype._ensureSecurityGroupExists = function( callback ) {
	var self = this;
	this._checkSecurityGroupExists( function( error, exists ) {
		if( error )
			callback( error );
		else
		{
			if( exists )
				callback( null );
			else
				self._createSecurityGroup( callback );
		}
	} );
}

LoadBalancedCluster.prototype._checkSecurityGroupExists = function( callback ) {
	var self = this;
	ec2.getSecurityGroups( this.config.region, function( error, groups ) {
		if( error )
			callback( error, null );
		else
		{
			var found = false;
			groups.forEach( function( g ) {
				if( g.name == self.config.securityGroup )
					found = true;
			});
			callback( null, found );
		}
	});
}

LoadBalancedCluster.prototype._createSecurityGroup = function( callback ) {
	this.logger.log( 'elastic (' + this.config.name + '): Creating Security Group.' );
				
	var self = this;
	ec2.createSecurityGroup( this.config.region, this.config.securityGroup, function( error, result ) {
		if( error )
			callback( error );
		else
			async.forEachSeries( self.config.firewallAllow, 
				function( rule, done ) {
					ec2.addFirewallAllow( self.config.region, self.config.securityGroup, rule, done );
				},
				callback
			);
	});
}

LoadBalancedCluster.prototype._ensureLoadBalancerExists = function( callback ) {
	var self = this;
	this._checkLoadBalancerExists( function( error, exists ) {
		if( error )
			callback( error );
		else
		{
			if( exists )
				callback( null );
			else
				self._createLoadBalancer( callback );
		}
	} );
}

LoadBalancedCluster.prototype._checkLoadBalancerExists = function( callback ) {
	var self = this;
	ec2.getElasticLoadBalancers( this.config.region, function( error, balancers ) {
		if( error )
			callback( error, null );
		else
		{
			var found = false;
			balancers.forEach( function( balancer ) {
				if( balancer.name == self.config.name )
				{
					found = true;
					self.externalDns = balancer.external;
				}
			});
			callback( null, found );
		}
	});
}

LoadBalancedCluster.prototype._createLoadBalancer = function( callback ) {
	this.logger.log( 'elastic (' + this.config.name + '): Creating load balancer.' );

	var self = this;
	
	ec2.createElasticLoadBalancer( 
		this.config.name, 
		this.config.region, 
		this.config.zones, 
		[ {
			"protocol": this.config.protocol,
			"inputPort": this.config.externalPort,
			"outputPort": this.config.internalPort
		} ], 
		function( error, result ) {
			if( !error )
			{
				self.externalDns = result[0].external;
			}
			callback( error );
		} );
}

LoadBalancedCluster.prototype._ensureFirstNodeExists = function( callback ) {
	var self = this;
	this._checkFirstNodeExists( function( error, exists ) {
		if( error )
			callback( error );
		else
		{
			if( exists )
				callback( null );
			else
				self._createFirstNode( callback );
		}
	} );
}

LoadBalancedCluster.prototype._checkFirstNodeExists = function( callback ) {
	var self = this;
	ec2.getRunningInstances( this.config.region, function( error, instances ) {
		if( error )
			callback( error );
		else
		{
			var found = false;
			instances.forEach( function( instance ) {
				if( instance.ami == self.config.ami )
					found = true;
			});
			callback( null, found );
		}
	});
}

LoadBalancedCluster.prototype._launchNewNode = function( callback ) {
	var self = this;
	ec2.launchInstance( this.config.region, this.config.ami, 
		this.config.keypair, this.config.type, this.config.securityGroup, 
		function( error, result ) {
			if( error )
				callback( error, null );
			else
			{
				ec2.setInstanceName( 
					self.config.region, result[0].instance, self.config.name, callback );
			}
		});
}
LoadBalancedCluster.prototype._launchNewNodeInZone = function( zone, callback ) {
	var self = this;
	this.logger.log( 'elastic (' + this.config.name + '): creating new node in ' + zone );
	ec2.launchInstanceInAvailabilityZone( this.config.region, this.config.ami, 
		this.config.keypair, this.config.type, this.config.securityGroup, zone,
		function( error, result ) {
			if( error )
				callback( error, null );
			else
			{
				ec2.setInstanceName( 
					self.config.region, result[0].instance, self.config.name, function( error, namingResult ) {
						if( error )
							callback( error, null );
						else
							callback( null, result[ 0 ] );
					} );
			}
		});
}
LoadBalancedCluster.prototype._createFirstNode = function( callback ) {
	this.logger.log( 'elastic (' + this.config.name + '): creating first node.' );
	this._launchNewNode( callback );
}
LoadBalancedCluster.prototype._getLeastPopulatedZone = function( callback ) {
	this.getNumberOfNodesPerZone( function( error, counts ) {
		if( error )
			callback( error, null );
		else
		{
			var min = null;
			var minZone = null;

			for( var z in counts ) {
				if( min == null || counts[z] < min )
				{
					minZone = z;
					min = counts[z];
				}
			}
			callback( null, minZone );
		}
	});
}
LoadBalancedCluster.prototype._getMostPopulatedZone = function( callback ) {
	this.getNumberOfNodesPerZone( function( error, counts ) {
		if( error )
			callback( error, null );
		else
		{
			var max = null;
			var maxZone = null;

			for( var z in counts ) {
				if( max == null || counts[z] > max )
				{
					maxZone = z;
					max = counts[z];
				}
			}
			callback( null, maxZone );
		}
	});
}
LoadBalancedCluster.prototype.addNode = function( callback ) {
	var self = this;
	this._getLeastPopulatedZone( function( error, zone ) {
		if( error )
			callback( error );
		else
		{
			self._launchNewNodeInZone( zone, function( error, instance ) {
				if( error )
					callback( error );
				else
				{
					ec2.attachInstanceToLoadBalancer( 
						self.config.region, instance.instance, self.config.name,
						function( error, result ) {
							if( error )
								callback( error );
							else
							{
								ec2.addLoadBalancerAvailabilityZone( self.config.region, self.config.name, zone, function( error, activeZones ) {
									callback( error );
								});
							}
						}
					);
				}
			});
		}
	});
}
LoadBalancedCluster.prototype.getNumberOfRunningNodes = function( callback ) {
	ec2.getBalancedInstances( this.config.region, this.config.name, function( error, balanced ) {
		if( error )
			callback( error, -1 );
		else
			callback( null, balanced.length );
	} );
}
LoadBalancedCluster.prototype.getNumberOfNodesPerZone = function( callback ) {
	var self = this;
	ec2.getBalancedInstances( this.config.region, this.config.name, function( error, balanced ) {
		if( error )
			callback( error, null );
		else
		{
			ec2.getRunningInstances( self.config.region, function( error, instances ) {
				if( error )
					callback( error, null );
				else
				{
					function _isBalanced( instance ) {
						for( var i=0; i<balanced.length; i++ ) {
							if( balanced[ i ].instance == instance.instance )
								return true;
						}
						return false;
					};

					var counts = {};

					self.config.zones.forEach( function( zone ) {
						counts[ zone ] = 0;
					});

					instances.forEach( function( instance ) {
						if( _isBalanced( instance ) ){
							if( counts[ instance.zone ] )
								counts[ instance.zone ] ++;
							else
								counts[ instance.zone ] = 1;
						}
					});

					callback( null, counts );
				}
			});
		}
	} );	
}
LoadBalancedCluster.prototype.removeNode = function( callback ) {
	var self = this;

	ec2.getBalancedInstances( self.config.region, self.config.name, function( error, balanced ) {
		if( error )
			callback( error );
		else
		{
			if( balanced.length > 1 )
			{
				ec2.getRunningInstances( self.config.region, function( error, instances ) {
					var zoneLookup = {};
					var amiLookup = {};
					instances.forEach( function( instance ) {
						amiLookup[ instance.instance ] = instance.ami;
						zoneLookup[ instance.instance ] = instance.zone;
					});
					// First check to see if there are any instances which came from the wrong AMI.
					var wrongImage = null;
					balanced.forEach( function( b ) {
						if( amiLookup[ b.instance ] != self.config.ami )
							wrongImage = b;
					});

					if( wrongImage )
					{
						self.logger.log( 'elastic (' + self.config.name + '): Terminating ' + wrongImage.instance + ' because it is from the wrong AMI.' );
						self._terminateInstance( wrongImage, instances, callback );
					}
					else
					{
						self.logger.log( 'elastic (' + self.config.name + '): Picking an instance from the most populated zone to terminate.' );
						self._getMostPopulatedZone( function( error, zone ) {
							var firstInstanceInZone = null;
							for( var i=0; i<balanced.length && !firstInstanceInZone; i++ )
							{
								if( zoneLookup[ balanced[i].instance ] == zone )
									firstInstanceInZone = balanced[i];
							}
							self._terminateInstance( firstInstanceInZone, instances, callback );
						});						
					}
				} );
			}
			else
			{
				callback( new Error( 'Cannot remove last node in a load balanced cluster.' ), null );
			}
		}
	} );
}
LoadBalancedCluster.prototype._terminateInstance = function( instance, runningInstances, callback ) {
	var self = this;
	self.logger.log( 'elastic (' + self.config.name + '): terminating node: ' + instance.instance );
		ec2.removeInstanceFromLoadBalancer( self.config.region, instance.instance, self.config.name, function( error, result ) {
			if( error )
				callback( error );
			else
			{
				self._optionallyNotifyInstanceOfShutdown( instance.instance, runningInstances, function( error ) {
					if( error )
						self.logger.log( 'elastic (' + self.config.name + '): error notifying instance of shutdown: ' + error );
					ec2.terminateInstance( self.config.region, instance.instance, function( error, result ) {
						callback( error, result );
					} );
				} );
			}
		} );
}
LoadBalancedCluster.prototype._optionallyNotifyInstanceOfShutdown = function( instanceToRemove, runningInstances, callback ) {
	var self = this;
	if( self.config.shutdownNotifier )
	{
		var instanceInternalIp = null;
		for( var i=0; i<runningInstances.length && !instanceInternalIp; i++ )
			if( runningInstances[i].instance == instanceToRemove )
				instanceInternalIp = runningInstances[i].internal;
		if( instanceInternalIp != null )
		{
			self.logger.log( 'elastic (' + self.config.name + '): Sending shutdown notification to: ' + instanceInternalIp );
			self.config.shutdownNotifier.announceShutdown( instanceInternalIp, callback );
		}
		else
		{
			callback( new Error( 'No IP address found for ' + instanceToRemove ));
		}
	}
	else
	{
		callback( null );
	}
}

LoadBalancedCluster.prototype._ensureExistingNodesAreConnected = function( callback ) {
	var self = this;
	ec2.getBalancedInstances( self.config.region, self.config.name, function( error, balanced ) {
		if( error )
			callback( error );
		else
		{
			ec2.getRunningInstances( self.config.region, function( error, instances ){
				if( error )
					callback( error );
				else
				{
					async.forEachSeries( instances, 
						function( instance, done ) {
							if( instance.ami == self.config.ami )
							{
								var found = false;
								balanced.forEach( function( b ) {
									if( b.instance == instance.instance )
										found = true;
								});
								if( found )
									done();
								else
								{
									self.logger.log( 'elastic (' + self.config.name + '): connecting instance ' + instance.instance );
									ec2.attachInstanceToLoadBalancer( 
										self.config.region, instance.instance, self.config.name,
										function( error, result ) {
											if( error )
												done( error );
											else
											{
												ec2.addLoadBalancerAvailabilityZone( self.config.region, self.config.name, instance.zone, function( error, activeZones ) {
													callback( error );
												});

											}
										});
								}
							}
							else
							{
								done();
							}
						},
						callback
					);			
				}
			} );
		}
	});
}

module.exports = exports = LoadBalancedCluster;
