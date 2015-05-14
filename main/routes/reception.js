/**
 *
 * Created by kc on 10.05.15.
 */
'use strict';

var express = require('express');
var router = express.Router();
var _ = require('lodash');

var settings = require('../settings');
var gameplayModel = require('../../common/models/gameplayModel');
var pricelist = require('../../common/lib/pricelist');
var teamModel = require('../../common/models/teamModel');
var authTokenManager = require('../lib/authTokenManager');

var ngFile = '/js/indexctrl.js';
if (settings.minifedjs) {
  ngFile = '/js/indexctrl.min.js'
}

/* GET the reception of all games */
router.get('*', function (req, res) {
  var gameId = _.trimLeft(req.url, '/');

  gameplayModel.getGameplay(gameId, req.session.passport.user, function (err, gp) {
    if (!gp) {
      gp = {};
    }
    var errMsg1 = '';
    if (err) {
      errMsg1 = err.message;
    }
    pricelist.getPricelist(gameId, function (err2, pl) {
      if (!pl) {
        pl = {};
      }
      var errMsg2 = '';
      if (err2) {
        errMsg2 = err2.message;
      }

      teamModel.getTeams(gameId, function (err3, foundTeams) {
        res.render('reception', {
          title: 'Ferropoly',
          ngFile: '/js/infoctrl.js',
          hideLogout: true,
          authToken: authTokenManager.getNewToken(req.session.passport.user),
          user: req.session.passport.user,
          err: errMsg1,
          err2: errMsg2,
          gameplay: JSON.stringify(gp),
          pricelist: JSON.stringify(pl),
          teams: JSON.stringify(foundTeams)
        });
      });
    });
  });
});


module.exports = router;