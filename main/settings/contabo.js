/**
 * Settings for the contabo server, its IP is 5.189.159.156
 * Created by kc on 15.08.15.
 */
'use strict';

module.exports = function (settings) {

  settings.server = {
    port: process.env.FERROPOLY_MAIN_PORT,
    host: 'app.ferropoly.ch',
    serverId: 'app.ferropoly.ch-v' + settings.version
  };

  settings.locationDbSettings = {
    mongoDbUrl: process.env.FERROPOLY_CONNECTION_STRING
  };

  settings.cron = {
    // [MINUTE] [HOUR] [DAY OF MONTH] [MONTH OF YEAR] [DAY OF WEEK] [YEAR (optional)]
  };

  //**** RELEASE SETTINGS ****
  settings.socketIoServer = {
    port: 80, // using proxy!
    host: 'spiel.ferropoly.ch'
  };

  // This is the highest priorized scheduler: the contabo main instance
  settings.scheduler = {
    delay: 0
  };

  return settings;
};
