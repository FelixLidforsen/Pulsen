function RemoteSystem( config ) {
	this.config = config;
}
RemoteSystem.prototype.setLogger = function( logger ) {
	this.logger = logger;
}
RemoteSystem.prototype.exec = function( command, callback ) {
	( require( './SpawnProcess' ) )( 
		'ssh', [
			'-i', this.config.key,
			'-q',
			'-o', 'StrictHostKeyChecking=false',
			this.config.user + '@' + this.config.address,
			command
		],
		function( results ) {
			callback( null, results );
		},
		function( errors ) {
			callback( errors, null );
		}
	);
}
module.exports = exports = RemoteSystem;