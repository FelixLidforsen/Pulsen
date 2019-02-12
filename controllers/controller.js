var DALMethod = require('../models/DAL');
require('../models/assets/loginCredentials.json');
var fs = require('fs');

{
//Function to fire search
       function firethisfuction(){
    DALMethod.clientsearcher();
    module.exports = {responseReader: function readResponse(responseObject){
        console.log(resp);
    },
  }; 
 };
};
