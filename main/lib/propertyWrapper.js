/**
 * Wrapper arount the property model, just delivers the data needed for the main game
 *
 * Reason for this module: simplify testing and access to properties
 * Created by kc on 24.04.15.
 */
'use strict';
var pm = require('../../common/models/propertyModel');

module.exports = {
  /**
   * Get the property for a given location and game
   * @param gameId
   * @param propertyId
   */
  getProperty: function (gameId, propertyId, callback) {
    pm.getPropertyById(gameId, propertyId, function (err, prop) {
      callback(err, prop);
    });
  },
  /**
   * Get the properties of a team
   * @param gameId
   * @param teamId
   * @param callback
   */
  getTeamProperties: function (gameId, teamId, callback) {
    pm.getPropertiesForGameplay(gameId, {'gamedata.owner': teamId}, function (err, properties) {
      if (err) {
        console.error(err);
        return callback(err);
      }
      callback(null, properties);
    })
  },
  /**
   * Update the property
   * @param property
   */
  updateProperty: function (property, callback) {
    pm.updateProperty(property.gameId, property, function (err) {
      callback(err);
    })
  }

};
