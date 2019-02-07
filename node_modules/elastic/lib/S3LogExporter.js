var s3 = require( 's3' );
var moment = require( 'moment' );
var async = require( 'async' );
var fs = require( 'fs' );
var spawnProcess = require( './SpawnProcess.js' );

function S3LogExporter( config ) {
	this.config = config;
	setTimeout( this.exportLogs.bind( this ), 500 );
}
S3LogExporter.prototype._recurseDirectory = function( rootPath, filename, container, callback ) {
	var self = this;
	fs.stat( ( rootPath ? rootPath + '/' : '' ) + filename, function( error, stats ) {
		if( !stats )
			callback();
		else if( stats.isFile() )
		{
			container.push( ( rootPath ? rootPath + '/' : '' ) + filename );
			callback();
		}
		else if( stats.isDirectory() )
		{
			fs.readdir( ( rootPath ? rootPath + '/' : '' ) + filename, function( error, filenames ) {
				if( !filenames || filenames.length == 0 )
					callback();
				else
				{
					async.forEach( filenames,
					function( newFilename, done ) {
						self._recurseDirectory( ( rootPath ? rootPath + '/' : '' ) + filename, newFilename, container, done );
					},
					function( error ) {
						callback();
					} );
				}
			} );
		}
	} );
}
S3LogExporter.prototype._getLogFiles = function( container, callback ) {
	var self = this;
	async.forEach( this.config.logFiles, 
		function( filename, done ) {
			self._recurseDirectory( null, filename, container, done );
		},
		function( error ) {
			callback( container );
		});
}
S3LogExporter.prototype.compileLogs = function( callback ) {
	var tarArguments = [ '-czf', this.config.tmp + '/' + this.config.prefix + '.log.tgz' ];
	var self = this;

	this._getLogFiles( tarArguments, function() {
		self.logger.log( 'Tar arguments will be: ' + require( 'util' ).inspect( tarArguments ) );
		spawnProcess( 'tar', tarArguments, callback, function( error ){
			callback( error );
		} );
	});
}
S3LogExporter.prototype.getHostname = function( callback ) {
	spawnProcess ( 'hostname', [], callback, callback );
}	
S3LogExporter.prototype.cleanup = function( callback ) {
	var rmArguments = [ this.config.tmp + '/' + this.config.prefix + '.log.tgz' ];
	this._getLogFiles( rmArguments, function() {
		spawnProcess( 'rm', rmArguments, callback, callback );
	});
}
S3LogExporter.prototype.exportLogs = function() {
	var self = this;

	if( !this.exportedOnce )
	{
		this.logger.log( 'System is starting up, exporting existing logs to S3.' );
		this.exportedOnce = true;
	}

	this.compileLogs( function( error ) {
		if( !error  || error != "Removing leading `/' from member names" )
		{
			var client = s3.createClient( {
				key: process.env.S3_API,
				secret: process.env.S3_SECRET,
				bucket: self.config.bucket
			});

			self.getHostname( function( name ) {
				var remoteFilename = self.config.prefix + '-' + name.trim() + '-' + moment().format() + '-logs.tgz';
				var uploader = client.upload( self.config.tmp + '/' + self.config.prefix + '.log.tgz', remoteFilename );
				uploader.on( 'end', function() {
					self.logger.log( 'Done Uploading logs to S3.' );
					self.cleanup( function() {
						self.logger.log( 'Done cleaning previous batch of logs: ' + remoteFilename );
						setTimeout( self.exportLogs.bind( self ), self.config.period );
					});
				});
			});

		}
		else
		{
			self.logger.log( 'Error uploading previous logs to S3: ' + error );
			self.logger.log( 'Will continue....' );
			setTimeout( self.exportLogs.bind( self ), self.config.period );
		}
	} );
}
S3LogExporter.prototype.setLogger = function( logger ) {
	this.logger = logger;
}
module.exports = exports = S3LogExporter;