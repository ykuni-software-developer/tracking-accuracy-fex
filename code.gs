var skubana_vheaders = {
 "Authorization":"Bearer <skubana_token>"
};

function skubanaShippedOrders() {
  var spreadSheets = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadSheets.getSheets()[0];
  var data = sheet.getDataRange().getValues();
  var shipDateFrom=new Date(data[1][7]);
  var shipDateTo=new Date((new Date()).valueOf() + 24*60*60*1000);
  var shipDateRange = `shipDateFrom=${shipDateFrom.toISOString().split('.')[0]}Z&shipDateTo=${shipDateTo.toISOString().split('.')[0]}Z`;
  var orders = getOrders(shipDateRange);
  var skubana_rows= getSkubanaRows(orders);
  var skubana_sheet = spreadSheets.getSheetByName("Skubana");
  skubana_sheet.getRange('A2:B').clearContent();
  if (skubana_rows.length>0){
    dataRange = skubana_sheet.getRange(2, 1, skubana_rows.length, 2);
    dataRange.setValues(skubana_rows);
  }

}

function getOrders(parameter){
  Logger.log(parameter);
  var url = `https://api.skubana.com/v1.1/orders?${parameter}&warehouseId=8101`;
  var options = {
    'method' : 'get',
    muteHttpExceptions: false,
    'contentType': 'application/json',
    'headers' : skubana_vheaders
  };
  var response = UrlFetchApp.fetch(url,options);
  var skubanaOrders = JSON.parse(response.getContentText());
  if (response.getResponseCode() != 200) {
    responseErrorHandling(
      response,
      "FEX to Skubana: cannot fetch orders in Skubana"
    );
  }
  Logger.log(skubanaOrders.length);
  return skubanaOrders;
}

function getSkubanaRows(orders){
  var rows=[];
  orders.forEach(function(order){
    var trackingNumber = "";
    if(order.shipment != null){
      trackingNumber = order.shipment.trackingNumber
    }
    rows.push([
      order.orderNumber,
      trackingNumber
    ]);
  });
  return rows;
}

function downloadFTP(){
  var token = ScriptApp.getIdentityToken();
  var options = {
    method : 'get',
    muteHttpExceptions: true,
    headers: {'Authorization': 'Bearer ' + token}
  }
  var url = "https://us-central1-ykuni-forecasting-integration.cloudfunctions.net/fex-ftp-csv";
  var response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode()!=200){
    responseErrorHandling(response, "Error: Cannot fetch FEX Daily Shipping Report");
  }
  var spreadSheets = SpreadsheetApp.getActiveSpreadsheet();
  var reportSheet = spreadSheets.getSheetByName("FEX Shipping Report");
  // Logger.log(blob.getContentText());
  fexShippingReport = Utilities.parseCsv(response.getContentText());
  reportSheet.getRange('A2:I').clearContent();
  Logger.log(fexShippingReport.length);
  if (fexShippingReport.length>0){
    dataRange = reportSheet.getRange(2, 1, fexShippingReport.length, 9);
    dataRange.setValues(fexShippingReport);
  }
}

function checkFEXReport(){
  var spreadSheets = SpreadsheetApp.getActiveSpreadsheet();
  var reportSheet = spreadSheets.getSheetByName("FEX Shipping Report");
  var data = reportSheet.getDataRange().getValues();
  unshippedInSkubana = [];
  for(var i=1; i<data.length; i++){
    if(data[i][0] == ""){break;}
    if( (data[i][9] =="#N/A") ){
      var unshippedData={
        "orderNumber": data[i][0],
        "trackingNumber": data[i][3],
        "shippingMethod": data[i][4].split(" ")[0]
      }
      unshippedInSkubana.push(unshippedData);
    }
  }
  Logger.log(unshippedInSkubana.length );
  if(unshippedInSkubana.length > 0){
    Logger.log("Getting unfulfilled Orders");
    var maxDate=new Date(data[1][7]);
    maxDate.setDate(maxDate.getDate()+1);
    var parameter = `orderDateTo=${maxDate.toISOString().split('.')[0]}Z&status=PENDING_FULFILLMENT`;
    unfulfilledOrders = getOrders(parameter);
    if(unfulfilledOrders.length > 0 ){
      updateSkubana(unshippedInSkubana, unfulfilledOrders);
    } else {
      emailOrdersForReview(unshippedinSkubana);
    }
  }
}

function updateSkubana(unshippedInSkubana, unfulfilledOrders){
  Logger.log(unshippedInSkubana.length);
  Logger.log(unfulfilledOrders.length);
  var shipments = [];
  var orderNotFound = [];
  for(var i=0; i < unshippedInSkubana.length; i++){
    var orderNumber=unshippedInSkubana[i]["orderNumber"];
    var trackingNumber=unshippedInSkubana[i]["trackingNumber"];
    var shippingMethod={
      "shippingCarrier":unshippedInSkubana[i]["shippingMethod"]
    };
    var isOrderFound=false;
    for(var j=0; j < unfulfilledOrders.length; j++){
      if(unfulfilledOrders[j].orderNumber.indexOf(orderNumber) !== -1){ // check if it contains the substring
        Logger.log(orderNumber);
        var shipmentData = {
          "trackingNumber": trackingNumber,
          "orderNumber": unfulfilledOrders[j].orderNumber,
          "salesChannelId": unfulfilledOrders[j].salesChannel.salesChannelId,
          "shipMethod": shippingMethod
        };
        shipments.push(shipmentData);
        Logger.log(shipmentData);
        isOrderFound=true;
        break;
      }
    }
    if(!isOrderFound){
      orderNotFound.push(unshippedInSkubana[i]);
    }
  }
  if (shipments.length > 0) {
    updateSkubanaShipment(shipments);
  }
  if (orderNotFound.length > 0){
    emailOrdersForReview(orderNotFound);
  }
}

function emailOrdersForReview(orderNotFound){
  var emailTemplate = HtmlService.createTemplateFromFile("notFoundOrders");
  emailTemplate.data = orderNotFound;
  emailnotif(
    recipient_email,
    emailTemplate.evaluate().getContent(),
    "FEX Shipping Report: Order numbers for review"
  );
}

function updateSkubanaShipment(shipments){
  var payload = {
    "shipments": shipments,
    "notifyCustomer": true,
    "updateChannel": true
  };
  var url = "https://api.skubana.com/v1.1/shipment/external";
  var options = {
    'method' : 'put',
    muteHttpExceptions: true,
    'contentType': 'application/json',
    'headers' : skubana_vheaders,
    'payload': JSON.stringify(payload)
  };
  var response = UrlFetchApp.fetch(url,options);
  var status = response.getResponseCode();
  
  if (status != 200) {
    responseErrorHandling(
      response,
      "FEX to Skubana: cannot update Skubana"
    );
  }
  Logger.log("Successfully updated tracking numbers in Skubana");
}