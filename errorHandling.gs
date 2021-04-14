var developer_email = "carmel@ykuni.com";
var recipient_email = "supply@epare.com";
function responseErrorHandling(response, subject_email){
  var result = response.getContentText();
  var status = response.getResponseCode();
  var message = result;
  Logger.log(result);
  // Get additional error message info, depending on format
  if (result.toUpperCase().indexOf("<HTML") !== -1) {
    var message = result.replace(/<[^>]+>/g, "");
  }
  else if (result.hasOwnProperty('errors')) {
    message = JSON.parse(result.errors);
  }
  emailnotif(developer_email, message, subject_email);
  throw new Error('Error (' + status + ") " + message );
}

function emailnotif(email, content, subject){
  MailApp.sendEmail({
    to: email,
    subject: subject,
    htmlBody: content
  });
}