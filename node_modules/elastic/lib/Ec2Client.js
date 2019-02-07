var moment = require( 'moment' );

process.env.EC2_HOME = __dirname + '/../ec2-api-tools-1.6.5.2';
process.env.AWS_CLOUDWATCH_HOME = __dirname + '/../CloudWatch-1.0.13.4';
process.env.AWS_ELB_HOME = __dirname + '/../ElasticLoadBalancing-1.0.17.0';

var ec2_bin = process.env.EC2_HOME + '/bin/';
var cloudwatch_bin = process.env.AWS_CLOUDWATCH_HOME + '/bin/';
var elb_bin = process.env.AWS_ELB_HOME + '/bin/';

function Ec2() {
}
Ec2.prototype.setLogger = function( logger ) {
	this.logger = logger;
}
Ec2.prototype._useCli = function( command, args, parsingRegex, objectParser, callback ) {
	( require( './SpawnProcess' ) )( 
		command, args,
		function( output ) {
			var results = [];
			var dataLines = output.match( new RegExp( parsingRegex, 'g' ) );
			if( dataLines != null )
			{
				dataLines.forEach( function( line ) {
					var matches = line.match( new RegExp( parsingRegex, '' ) );
					if( matches )
						results.push( objectParser( matches ) );
				});
			}
			callback( null, results );
		},
		function( errors ) {
			callback( errors, null );
		}
	);		
}
//./mon-get-stats CPUUtilization --namespace "AWS/EC2" --statistics "Minimum,Maximum,Average" --headers --period 60 --dimensions "InstanceId=i-37211948"
Ec2.prototype.getAverageCPUUtilization = function( region, instanceId, callback ) {
	var newestEntry = null;
	this._useCli( 
		cloudwatch_bin + 'mon-get-stats',
		[ 
			'CPUUtilization',
			'--namespace', '"AWS/EC2"', 
			'--statistics', '"Average"', 
			'--headers' ,
			'--period', 60,
			'--region', region,
			'--dimensions', '"InstanceId=' + instanceId + '"' 
		],
		'([0-9\-]+ [0-9:]+) +([0-9\.]+) +Percent',
		function( matches ) {
			var date = moment( matches[1], 'YYYY-MM-DD HH:mm:ss' );
			if( !newestEntry || date.valueOf() > newestEntry.timestamp )
				newestEntry = {
					"timestamp": date.valueOf(),
					"percent": parseFloat( matches[2] )
				}
			return 0;
		},
		function( error, result ) {
			if( !error )
				callback( null, newestEntry != null ? newestEntry.percent : 0 );
			else
				callback( error, null );
		} );
}
Ec2.prototype.createElasticLoadBalancer = function( name, region, zones, ports, callback ) {
	params = [ name ];
	ports.forEach( function( port ) {
		params.push( '--listener' );
		params.push( '"protocol=' + port.protocol + ', lb-port=' + port.inputPort + ', instance-port=' + port.outputPort + '"' );
	});
	params.push( '--region' );
	params.push( region );
	params.push( '--availability-zones' );
	params.push( this._assembleParamList( zones ) );

	this._useCli( 
		elb_bin + 'elb-create-lb', params,
		'DNS_NAME[\t ]+([A-Za-z0-9\-\.]+)',
		function( matches ) {
			return {
				external: matches[1]
			}
		},
		callback );
};
Ec2.prototype.deleteElasticLoadBalancer = function( name, region, callback ) {
	this._useCli(
		elb_bin + 'elb-delete-lb', 
		[
			name, 
			'--region', region,
			'--force'
		],
		'(.+)',
		function( matches ) {
			return {
				output: matches[1]
			};
		},
		callback );
};
Ec2.prototype._assembleListenerParams = function( ports ) {
	var list = '"';
	for( var i=0; i< ports.length; i++ )
	{
		list += 'prototcol=' + ports[i].protocol + ', lb-port=' + ports[i].inputPort + ', instance-port=' + ports[i].outputPort;
		if( i < ports.length-1 )
			list += ', ';
	}
	list += '"';

	return list;
}
Ec2.prototype.getElasticLoadBalancers = function( region, callback ) {
	this._useCli( 
		elb_bin + 'elb-describe-lbs',
		[ 
			'--region', region,
			'--show-long'
		],
		'LOAD_BALANCER,([A-Za-z0-9\-]+),([A-Za-z0-9\-\.]+),[A-Za-z0-9\-\.]+,[A-Za-z0-9\-\.]+,"[^"]*","?([A-Za-z0-9\-\, ]+)"?,',
		function( matches ) {
			var result = {
				"name": matches[1],
				"external": matches[2],
				"zones": matches[3].split( ', ' )
			};
			return result;
		},
		callback );
}
Ec2.prototype.addLoadBalancerAvailabilityZone = function( region, balancerName, zone, callback ) {
	this._useCli(
		elb_bin + 'elb-enable-zones-for-lb',
		[ 
			balancerName,
			'--region', region,
			'--availability-zones', zone
		],
		'AVAILABILITY_ZONES +([A-Za-z0-9\-, ]+)',
		function( matches ) {
			return {
				"zones": matches[1].split( ', ' )
			};
		},
		callback );		
}
Ec2.prototype.getBalancedInstances = function( region, balancerName, callback ) {
	this._useCli(
		elb_bin + 'elb-describe-instance-health',
		[ 
			balancerName,
			'--region', region
		],
		'INSTANCE_ID +([A-Za-z0-9\-]+) +([A-Za-z0-9\-\.]+)',
		function( matches ) {
			return {
				"instance": matches[1],
				"state": matches[2]
			};
		},
		callback );		
}
Ec2.prototype.getRunningInstances = function( region, callback ) {
	this._useCli(
		ec2_bin + 'ec2-describe-instances',
		[ '--region', region ],
		'INSTANCE\t([A-Za-z0-9\-]+)\t([A-Za-z0-9\-]+)\t([A-Za-z0-9\-\.]+)\t([A-Za-z0-9\-\.]+)\t[A-Za-z]+\t[A-Za-z\-]+\t[0-9]+\t+([a-z0-9\.]+)\t+[A-Za-z0-9\-\:\.\+]+\t+([a-z0-9\-]+)', //
		function( matches ) {
			return {
				"instance": matches[1],
				"ami": matches[2],
				"external": matches[3],
				"internal": matches[4],
				"type": matches[5],
				"zone": matches[6]
			};
		},
		callback );
}
Ec2.prototype.getAMIs = function( region, callback ) {
	this._useCli(
		ec2_bin + 'ec2-describe-images',
		[ '--region', region ],
		'IMAGE\t([A-Za-z0-9\-]+)\t([A-Za-z0-9\-\/ ]+)\t([A-Za-z0-9\-]+)\t([A-Za-z0-9\-]+)',
		function( matches ) {
			return {
				"ami": matches[1],
				"name": matches[2],
				"state": matches[4]
			};
		},
		callback );
}
Ec2.prototype.setInstanceName = function( region, instance, name, callback ) {
	this.setInstanceTag( region, instance, 'Name', name, callback );
}
Ec2.prototype.setInstanceTag = function( region, instance, tag, value, callback ) {
	var self = this;
	this._useCli(
		ec2_bin + 'ec2addtag',
		[ '--region', region, instance, '--tag', tag + '=' + value ],
		'TAG\tinstance\t[A-Za-z0-9\-\/ ]+\t' + tag + '\t(.+)',
		function( matches ) {
			var result = {};
			result[ tag ]= matches[1];
			return result;
		},
		callback );
}
Ec2.prototype.terminateInstance = function( region, instance, callback ) {
	var self = this;
	( require( './SpawnProcess' ) )( 
		ec2_bin + 'ec2-terminate-instances',
		[ '--region', region, instance ],
		function( output ) {
			var retry = 0;
			function checkTerminated() {
				self.getRunningInstances( region, function( error, instances ) {
					var found = false;
					instances.forEach( function( foundInstance ) {
						if( foundInstance.instance == instance )
							found = true;
					});

					if( !found )
						callback( null );
					else
					{
						retry++;
						if( retry < 12 )
							setTimeout( checkTerminated, 5000 );
						else
							callback( 'Instance took too long to terminate: ' + instance );
					}
				});
			}
			setTimeout( checkTerminated, 5000 );
		},
		function( errors ) {
			callback( errors );
		}
	);	
}
Ec2.prototype.launchInstance = function( region, image, keypair, type, group, callback ) {
	this._useCli(
		ec2_bin + 'ec2-run-instances',
		[ '--region', region, '-n', 1, '-k', keypair, '-t', type, '-g', group, image ],
		'INSTANCE\t([A-Za-z0-9\-]+)',
		function( matches ) {
			return {
				"instance": matches[1],
			};
		},
		callback );
}
Ec2.prototype.launchInstanceInAvailabilityZone = function( region, image, keypair, type, group, zone, callback ) {
	this._useCli(
		ec2_bin + 'ec2-run-instances',
		[ 
			'--region', region, 
			'-n', 1, 
			'-k', keypair, 
			'-t', type, 
			'-g', group, 
			'-z', zone,
			image ],
		'INSTANCE\t([A-Za-z0-9\-]+)',
		function( matches ) {
			return {
				"instance": matches[1],
			};
		},
		callback );
}
Ec2.prototype.getSecurityGroups = function( region, callback ) {
	this._useCli( 
		ec2_bin + 'ec2-describe-group',
		[ '--region', region ],
		'GROUP[ \t]+([A-Za-z0-9\-]+)[ \t]+[0-9]+[ \t]+([A-Za-z0-9\-]+)[ \t]+([A-Za-z ])',
		function( matches ) {
			return {
				"id": matches[1],
				"name": matches[2],
				"description": matches[3]
			}
		},
		callback );
}
Ec2.prototype.createSecurityGroup = function( region, name, callback ) {
	this._useCli( 
		ec2_bin + 'ec2-create-group',
		[ '--region', region, name, '-d', name ],
		'(.+)',
		function( matches ) {
			return {
				"result": matches[1]
			}
		},
		callback );
}
Ec2.prototype._assembleParamList = function( array ) {
	var list = '';
	for( var i=0; i<array.length; i++ )
	{
		list += array[ i ];
		if( i < array.length-1 )
			list += ','
	}
	return list;
}
Ec2.prototype.attachInstanceToLoadBalancer = function( region, instanceId, loadBalancerName, callback ) {
	this._useCli(
		elb_bin + 'elb-register-instances-with-lb',
		[ 
			loadBalancerName, 
			'--region', region,
			'--instances', instanceId
		],
		'INSTANCE\t([A-Za-z0-9\-]+)',
		function( matches ) {
			return {
				"instance": matches[1],
			};
		},
		callback );
}
Ec2.prototype.removeInstanceFromLoadBalancer = function( region, instanceId, loadBalancerName, callback ) {
	this._useCli( 
		elb_bin + 'elb-deregister-instances-from-lb',
		[
			loadBalancerName,
			'--instances', instanceId,
			'--region', region
		],
		'INSTANCE\t([A-Za-z0-9\-]+)',
		function( matches ) {
			return {
				"instance": matches[1],
			};
		},
		callback );
}
Ec2.prototype.addFirewallAllow = function( region, securityGroup, rule, callback ) {
	params = [
		'--region', region,
		securityGroup,
		'-p', rule.port,
	];
	if( rule.hasOwnProperty( 'subnet' ))
	{
		params.push( '-s' );
		params.push( rule.subnet );
	}
	if( rule.hasOwnProperty( 'group' ))
	{
		params.push( '-o' );
		params.push( rule.group );
	}
	this._useCli(
		ec2_bin + 'ec2-authorize',
		params,
		'(.+)',
		function( matches ) {
			return {
				'result': matches[1]
			}
		},
		callback );
}
module.exports = exports = new Ec2();