/**
 * The index route
 * Created by kc on 14.04.15.
 */

const express      = require('express');
const router       = express.Router();
const settings     = require('../settings');
const users        = require('../../common/models/userModel');
const errorHandler = require('../lib/errorHandler');

let ngFile = '/js/indexmctrl.js';
if (settings.minifiedjs) {
  ngFile = '/js/min/indexmctrl.min.js';
}

/* GET home page. */
router.get('/', function (req, res) {
  users.getUserByMailAddress(req.session.passport.user, function (err, user) {
    if (err) {
      return errorHandler(res, 'Interner Fehler beim Laden des Users.', err, 500);
    }
    res.render('index', {
      title       : 'Ferropoly Spielauswertung',
      ngController: 'indexCtrl',
      ngApp       : 'indexApp',
      ngFile      : ngFile,
      user        : user,
      userJson    : JSON.stringify(user)
    });
  });
});

module.exports = router;
