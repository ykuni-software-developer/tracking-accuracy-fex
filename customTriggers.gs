function setWeekdaysTrigger() {
  var daysWeek  = [
    ScriptApp.WeekDay.TUESDAY,
    ScriptApp.WeekDay.WEDNESDAY,
    ScriptApp.WeekDay.THURSDAY,
    ScriptApp.WeekDay.FRIDAY,
    ScriptApp.WeekDay.SATURDAY,
  ]; //put Enums for days of the week here;

  daysWeek.forEach(function(day){
    ScriptApp.newTrigger('skubanaShippedOrders')
      .timeBased()
      .onWeekDay(day)
      .atHour(1)
      .create();      
  });

  //set trigger to specific week days;
  daysWeek.forEach(function(day){
    ScriptApp.newTrigger('downloadFTP')
      .timeBased()
      .onWeekDay(day)
      .atHour(0)
      .create();      
  });

  daysWeek.forEach(function(day){
    ScriptApp.newTrigger('checkFEXReport')
      .timeBased()
      .onWeekDay(day)
      .atHour(2)
      .create();      
  });

}