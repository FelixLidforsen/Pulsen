var ec2 = require( './Ec2Client' );


module.exports.waitForStartup = function( config, callback ) {
	var waitFunction = function( error, launched ) {
		if( error )
			callback( error );
		else
		{
			var newInstanceId = launched[0].instance;

			function findActiveInstance() {
				ec2.getRunningInstances( config.zone, 
					function( error, runningInstances ) {
						var newInstance = null;
						runningInstances.forEach( function( i ) {
							if( i.instance == newInstanceId )
								newInstance = i;
						} );
						if( newInstance && newInstance.external )
						{
							var newServer = new ( require( './RemoteSystem' ))( {
								'key':config.key,
								'user': config.user,
								'address': newInstance.external
							});
							function checkUptime() {
								newServer.exec( 'uptime', function( error, result ) {
									if( error )
										callback( new Error( 'ERROR ON EXEC: ' + require( 'util' ).inspect( error )));
									else
									{
										if( !result )
										{
											setTimeout( checkUptime, 10000 );
										}
										else
										{
											newInstance.remoteSystem = newServer;
											callback( null, newInstance );
										}
									}
								});
							}
							checkUptime();
						}
						else
							setTimeout( findActiveInstance, 1000 );
					}
				);
			}
			findActiveInstance();
		}
	}
	return waitFunction;
}