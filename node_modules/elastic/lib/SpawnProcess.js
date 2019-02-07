module.exports = function( command, arguments, successCallback, failureCallback ) {

	var async = require( 'async' );
	var spawn = require( 'child_process' ).spawn,
	    describe = spawn( 
	    	command, 
	    	arguments
		);

	var output = '';
	var errors = '';

	async.parallel( [
			function( done ) {
				describe.stdout.on( 'data', function( buffer ) {
					output += buffer;
				});
				describe.stdout.on( 'end', function() {
					done();
				});
			},
			function( done ) {
				describe.stderr.on( 'data', function( buffer ) {
					errors += buffer;
				});
				describe.stderr.on( 'end', function() {
					done();
				});
			}
		],
		function( error ) {
			if( errors.length > 0 )
			{
				failureCallback( errors );
			}
			else
			{
				successCallback( output );
			}
		}
	);
}