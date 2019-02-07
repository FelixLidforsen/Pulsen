var defaultLogger;

module.exports.ec2Client = require( './lib/Ec2Client' );
module.exports.LoadBalancedCluster = function( config ) {
	var cluster = new( require( './lib/LoadBalancedCluster' ))( config );
	cluster.setLogger( defaultLogger );

	return cluster;
}

var ShutdownComponents = require( './lib/Shutdown' );
// A Shutdown Notifier is responsible for informing a remote system that it is about to be
// shut down, and informing the local system when the remote has completed any shutdown tasks.
module.exports.ShutdownNotifier = function( config ) {
	var controller = new ShutdownComponents.Notifier( config );
	controller.setLogger( defaultLogger );

	return controller;
}

// A Shutdown Listener is responsible for receiving notification from the ShutdownController that
// the system on which it is running is about to be shut down.
module.exports.ShutdownListener = function( config ) {
	var listener = new ShutdownComponents.Listener( config );
	listener.setLogger( defaultLogger );

	return listener;
}

// A LogExporter is responsible for periodically bundling up log files and pushing them to S3.
module.exports.S3LogExporter = function( config ) {
	var exporter = new( require( './lib/S3LogExporter' ))( config );
	exporter.setLogger( defaultLogger );

	return exporter;
}

// To execute commands on a remote system, you can use a RemoteSystem
module.exports.RemoteSystem = function( config ) {
	var remoteSystem = new( require( './lib/RemoteSystem' ))( config );
	remoteSystem.setLogger( defaultLogger );

	return remoteSystem;
}

module.exports.Util = require( './lib/InstanceUtil' );

module.exports.setLogger = function( logger ) {
	defaultLogger = logger;
	module.exports.ec2Client.setLogger( logger );
}

module.exports.setLogger( {
		log: function( obj ) {
			console.log( obj );
		}
	} );

module.exports.spawnProcess = require( './lib/SpawnProcess' );
