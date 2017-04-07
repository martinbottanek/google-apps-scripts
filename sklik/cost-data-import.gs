/*

  Cost Data Import from Sklik to Google Analytics

  Original Version By: Stanislav Jilek [standajilek.cz]

*/

var spreadsheet = SpreadsheetApp.openByUrl('INSERT HERE');

function main() {
  var spreadsheetSettings = spreadsheet.getSheetByName("cost_import");
  var settings = spreadsheetSettings.getRange("A4:H" + spreadsheetSettings.getLastRow()).getValues();

  // loop over all accounts in spreadsheet
  for (var j = 0; j < settings.length; j++) {

    // Google Analytics
    var accountId = settings[j][0];
    var propertyId = settings[j][1];
    var importId = settings[j][2];
    var days = settings[j][3];
  
    // Sklik
    var sklikToken = settings[j][4];
    var sklikAccount = settings[j][5];
    var sklikSource = settings[j][6];
    var sklikMedium = settings[j][7];
  
    // Array with data 
    var data = [["ga:date", "ga:medium", "ga:source", "ga:adCost", "ga:adClicks", "ga:impressions", "ga:campaign"]]

    // login & get data from Sklik API
    try {
      // client.login 
      var clientLogin = sklikAPI('client.loginByToken', [sklikToken]);
      var session = clientLogin.session;
    
      // client.get
      var clientGet = sklikAPI('client.get', [{'session': session}]);
    
      for (var i = 0; i < clientGet.foreignAccounts.length; i++) {
        if (sklikAccount.toLowerCase() == clientGet.foreignAccounts[i].username.toLowerCase()) {
          var sklikAccountId = clientGet.foreignAccounts[i].userId;
        }
      }
    
      // format date for campaigns.createReport
      var dateStart = new Date();
    
      dateStart.setUTCDate(dateStart.getUTCDate() - days);
      dateStart = Utilities.formatDate(dateStart, 'GTM - 1', 'yyyy-MM-dd');
    
      var dateEnd = new Date();
      
      dateEnd.setUTCDate(dateEnd.getUTCDate() - 1);
      dateEnd = Utilities.formatDate(dateEnd, 'GTM - 1', 'yyyy-MM-dd');
      
      // build a report using campaigns.createReport
      var createCampaignsReport = sklikAPI('campaigns.createReport', [{'session': session, 'userId': sklikAccountId}, {'dateFrom': dateStart, 'dateTo': dateEnd }, {'statGranularity': 'daily'}]);
      var campaignsReport = sklikAPI('campaigns.readReport', [{'session': session, 'userId': sklikAccountId}, createCampaignsReport.reportId, {'offset': 0, 'limit': 100000, 'allowEmptyStatistics': true, 'displayColumns': ['id', 'name', 'impressions', 'clicks', 'clickMoney']}]);
      
      // compose array with data from campaigns.readReport
      var i = 0;
      var d = 0;
      
      while (i < campaignsReport.report.length) {
        for (var d = 0; d < days; d++) {
          if (Array.isArray(campaignsReport.report[i].stats)) {
            data.push([(campaignsReport.report[i].stats[d].date.toString()).substr(0, 8), sklikMedium, sklikSource, campaignsReport.report[i].stats[d].clickMoney / 100, campaignsReport.report[i].stats[d].clicks, campaignsReport.report[i].stats[d].impressions, campaignsReport.report[i].name]);
          }
        }
        
        i++;
      }
            
      // client.logout
      var clientLogout = sklikAPI('client.logout', [{'session': session}]);
  
    } catch (err) {
      Logger.log("SKLIK: " + err);
    }

    // compose & push data to Google Analytics
    try {
      if (data.length > 1) {
        // create file
        var blob = Utilities.newBlob(data.join("\n"), "application/octet-stream", "Cost import");
      
        // upload to Google Analytics
        var upload = Analytics.Management.Uploads.uploadData(accountId, propertyId, importId, blob);
      }
    } catch (err) {
      Logger.log("ANALYTICS: " + err);
    }
  }
}

// query Sklik API
function sklikAPI(method, parameters) {
  return(JSON.parse(UrlFetchApp.fetch('https://api.sklik.cz/jsonApi/drak/' + method, {'method': 'post', 'contentType': 'application/json', 'muteHttpExceptions': true, 'payload': JSON.stringify(parameters)})));
}
