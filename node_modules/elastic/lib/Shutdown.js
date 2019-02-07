var http = require( 'http' );

function Listener( config ) {
	this.config = config;

	var app = require( 'express' )();
	app.get('/', function(req, res){
		if( config.onShutdown )
			config.onShutdown( function( error ) {
				if( error ) {
					res.status( 500 );
					res.send( error );
				}
				else
				{
					res.status( 200 );
					res.send( '' );
				}
			});
		else
		{
			res.status( 200 );
			res.send( '' );
		}
	});

	app.listen( config.listenPort );
};
Listener.prototype.setLogger = function( logger ) {
	this.logger = logger;
}

function Notifier( config ) {
	this.config = config;
};
Notifier.prototype.setLogger = function( logger ) {
	this.logger = logger;
}
Notifier.prototype.announceShutdown = function( remoteAddr, callback ) {
	var request = http.request( 
		{
			method: 'GET',
			host: remoteAddr,
			port: this.config.notifyPort,
			path: '/'
		},
		function( response ) {
			if( response.statusCode == 200 )
				callback( null );
			else
			{
				var resultText = '';

				response.on( 'data', function( chunk ) {
					resultText += chunk;
				} );
				response.on( 'end', function() {
					callback( resultText );
				} );						

			}
		}
	);
	request.on( 'error', function( e ) {
		callback( e );
	} );
	request.setTimeout( 60000, function() {
		callback( new Error( 'Remote shutdown took longer than 60 seconds.' ));
	});
	request.end();
};

module.exports.Listener = Listener;
module.exports.Notifier = Notifier;