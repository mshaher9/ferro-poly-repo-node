/**
 * Marketplace integration test. These are straight forward, simple tests
 *
 * THIS TEST REQUIRES THE FERROPOLY-EDITOR PROJECT BEING ON ITS DESIGNATED PLACE
 *
 * Created by kc on 25.04.15.
 */
'use strict';
var expect = require('expect.js');
var _ = require('lodash');

var db = require('./../../common/lib/ferropolyDb');
var pricelistLib = require('./../../common/lib/pricelist');
var gameCache = require('../../main/lib/gameCache');
var marketplace = require('../../main/lib/accounting/marketplace');
var teamAccount = require('../../main/lib/accounting/teamAccount');
var settings = require('./../../main/settings');

var gameId;
var gameData;
var pricelist;

describe('Marketplace integration tests', function () {
  this.timeout(5000);
  before(function (done) {
    require('../fixtures/demoGamePlay').createDemo({}, function (err, res) {
        gameId = res.gameId;
        db.init(settings, function (err) {
          gameCache.getGameData(gameId, function (err, gd) {
            gameData = {
              gameplay: gd.gameplay,
              teams: _.values(gd.teams)
            };

            for (var i = 0; i < gameData.teams.length; i++) {
              gameData.teams[i].expectedMoney = 0;
            }
            pricelistLib.getPricelist(gameId, function (err, list) {
              pricelist = list;
              done(err);
            });
          });
        });
      }
    )
  });

  describe('Paying interest', function () {
    it('should pay once', function (done) {
      marketplace.payInterests(gameId, function (err) {
        expect(err).to.be(null);
        teamAccount.getBalance(gameId, gameData.teams[0].uuid, function (err, info) {
          expect(info.balance).to.be(gameData.gameplay.gameParams.interest);
          expect(info.entries).to.be(1);
          done(err);
        });
      });
    });

    it('should pay twice', function (done) {
      marketplace.payInterests(gameId, function (err) {
        expect(err).to.be(null);
        teamAccount.getBalance(gameId, gameData.teams[4].uuid, function (err, info) {
          expect(info.balance).to.be(gameData.gameplay.gameParams.interest * 2);
          expect(info.entries).to.be(2);
          done(err);
        });
      });
    });

    it('should pay a third time', function (done) {
      marketplace.payInterests(gameId, function (err) {
        expect(err).to.be(null);
        teamAccount.getBalance(gameId, gameData.teams[5].uuid, function (err, info) {
          expect(info.balance).to.be(gameData.gameplay.gameParams.interest * 3);
          expect(info.entries).to.be(3);
          done(err);
        });
      });
    });

    it('should pay a fourth time', function (done) {
      marketplace.payInterests(gameId, function (err) {
        expect(err).to.be(null);
        teamAccount.getBalance(gameId, gameData.teams[7].uuid, function (err, info) {
          expect(info.balance).to.be(gameData.gameplay.gameParams.interest * 4);
          expect(info.entries).to.be(4);

          teamAccount.getAccountStatement(gameId, gameData.teams[3].uuid, function (err, data) {
            expect(data.length).to.be(4);
            expect(data[3].transaction.amount).to.be(gameData.gameplay.gameParams.interest);

            // set the expected money values now
            for (var i = 0; i < gameData.teams.length; i++) {
              gameData.teams[i].expectedMoney = gameData.gameplay.gameParams.interest * 4;
              gameData.teams[i].expectedEntries = 4;
            }
          });
          done(err);
        });
      });
    });
  });

  describe('Building houses', function () {
    it('should do nothing as there are no properties', function (done) {
      marketplace.buildHouses(gameId, gameData.teams[0].uuid, function (err, info) {
        expect(info.amount).to.be(0);
        expect(info.log.length).to.be(0);
        done(err);
      })
    });
  });

  describe('Buying some properties', function () {
    it('should buy the cheapest place for team 0', function (done) {
      marketplace.buyProperty(gameId, gameData.teams[0].uuid, pricelist[0].uuid, function (err, info) {
        expect(err).to.be(null);
        expect(info.property.gameId).to.be(gameId);
        expect(info.property.pricelist.price).to.be(1000);
        expect(info.amount).to.be(1000);
        gameData.teams[0].expectedMoney -= 1000;
        gameData.teams[0].expectedEntries++;

        teamAccount.getBalance(gameId, gameData.teams[0].uuid, function (err, info) {
          expect(info.balance).to.be(gameData.teams[0].expectedMoney);
          expect(info.entries).to.be(gameData.teams[0].expectedEntries);

          teamAccount.getAccountStatement(gameId, gameData.teams[0].uuid, function (err, data) {
            expect(data.length).to.be(gameData.teams[0].expectedEntries);
            expect(data[gameData.teams[0].expectedEntries - 1].transaction.amount).to.be(-1000);
          });
          done(err);
        });
      })
    });

    it('should buy the most expensive place for team 0', function (done) {
      var index = 79;
      var price = 8000;
      var teamIndex = 0;
      marketplace.buyProperty(gameId, gameData.teams[teamIndex].uuid, pricelist[index].uuid, function (err, info) {
        expect(err).to.be(null);
        expect(info.property.gameId).to.be(gameId);
        expect(info.property.pricelist.price).to.be(price);
        expect(info.amount).to.be(price);

        console.log('Team ' + gameData.teams[teamIndex].uuid + ' bought ' + pricelist[index].uuid + ' ' + pricelist[index].location.name)

        gameData.teams[teamIndex].expectedMoney -= price;
        gameData.teams[teamIndex].expectedEntries++;

        teamAccount.getBalance(gameId, gameData.teams[teamIndex].uuid, function (err, info) {
          expect(info.balance).to.be(gameData.teams[teamIndex].expectedMoney);
          expect(info.entries).to.be(gameData.teams[teamIndex].expectedEntries);

          teamAccount.getAccountStatement(gameId, gameData.teams[teamIndex].uuid, function (err, data) {
            expect(data.length).to.be(gameData.teams[teamIndex].expectedEntries);
            expect(data[gameData.teams[teamIndex].expectedEntries - 1].transaction.amount).to.be(price * (-1));
          });
          done(err);
        });
      });
    });
  });


  describe('Building houses', function () {
    it('should do nothing as building is not allowed before paying interest', function (done) {
      marketplace.buildHouses(gameId, gameData.teams[0].uuid, function (err, info) {
        expect(info.amount).to.be(0);
        expect(info.log).to.be(undefined);
        done(err);
      })
    });
  });


  describe('Pay rent & interest, allow building houses', function() {
    it('should pay the rent', function(done) {
      marketplace.payRents(gameId, function(err) {
        done(err);
      })
    });
  });

  describe('Building houses', function () {
    describe('Building houses #1', function () {
      it('should build two houses (1)', function (done) {
        var teamIndex = 0;
        var buildingNbExpected = 1;
        marketplace.buildHouses(gameId, gameData.teams[0].uuid, function (err, info) {
          console.log(info);
          expect(info.amount).to.be(-4500);
          expect(info.log.length).to.be(2);
          // the order is not predictable, try
          var i = 0;
          if (info.log[1].amount === -500) {
            i = 1;
          }
          expect(info.log[i].amount).to.be(-500);
          expect(info.log[i].buildingNb).to.be(buildingNbExpected);
          expect(info.log[i].property).to.be(pricelist[0].uuid);
          expect(info.log[i].propertyName).to.be(pricelist[0].location.name);

          gameData.teams[teamIndex].expectedMoney -= 4500;
          gameData.teams[teamIndex].expectedEntries++;

          teamAccount.getBalance(gameId, gameData.teams[teamIndex].uuid, function (err, info) {
            expect(info.balance).to.be(gameData.teams[teamIndex].expectedMoney);
            expect(info.entries).to.be(gameData.teams[teamIndex].expectedEntries);

            teamAccount.getAccountStatement(gameId, gameData.teams[teamIndex].uuid, function (err, data) {
              console.log(data);
              expect(data.length).to.be(gameData.teams[teamIndex].expectedEntries);
              var lastEntry = _.last(data);
              expect(lastEntry.transaction.parts.length).to.be(2);
              expect(lastEntry.transaction.parts[1].propertyName.length).to.be.above(1);
              expect(lastEntry.transaction.parts[1].property.length).to.be.above(16);
              expect(lastEntry.transaction.parts[1].buildingNb).to.be(buildingNbExpected);
              expect(lastEntry.transaction.parts[1].amount).to.be.lessThan(0);
              expect(lastEntry.transaction.amount).to.be(-4500);
            });
            done(err);
          });
        });
      });
    });

    describe('Pay rent & interest, allow building houses', function() {
      it('should pay the rent', function(done) {
        marketplace.payRents(gameId, function(err) {
          done(err);
        })
      });
    });

    describe('Building houses #2', function () {
      it('should build two houses (2)', function (done) {
        var teamIndex = 0;
        var buildingNbExpected = 2;
        marketplace.buildHouses(gameId, gameData.teams[0].uuid, function (err, info) {
          console.log(info);
          expect(info.amount).to.be(-4500);
          expect(info.log.length).to.be(2);
          // the order is not predictable, try
          var i = 0;
          if (info.log[1].amount === -500) {
            i = 1;
          }
          expect(info.log[i].amount).to.be(-500);
          expect(info.log[i].buildingNb).to.be(buildingNbExpected);
          expect(info.log[i].property).to.be(pricelist[0].uuid);
          expect(info.log[i].propertyName).to.be(pricelist[0].location.name);

          gameData.teams[teamIndex].expectedMoney -= 4500;
          gameData.teams[teamIndex].expectedEntries++;
          done(err);
        });
      });
    });

    describe('Pay rent & interest, allow building houses', function() {
      it('should pay the rent', function(done) {
        marketplace.payRents(gameId, function(err) {
          done(err);
        })
      });
    });

    describe('Building houses #3', function () {
      it('should build two houses (3)', function (done) {
        var teamIndex = 0;
        var buildingNbExpected = 3;
        marketplace.buildHouses(gameId, gameData.teams[0].uuid, function (err, info) {
          console.log(info);
          expect(info.amount).to.be(-4500);
          expect(info.log.length).to.be(2);
          // the order is not predictable, try
          var i = 0;
          if (info.log[1].amount === -500) {
            i = 1;
          }
          expect(info.log[i].amount).to.be(-500);
          expect(info.log[i].buildingNb).to.be(buildingNbExpected);
          expect(info.log[i].property).to.be(pricelist[0].uuid);
          expect(info.log[i].propertyName).to.be(pricelist[0].location.name);

          gameData.teams[teamIndex].expectedMoney -= 4500;
          gameData.teams[teamIndex].expectedEntries++;

          done(err);
        });
      });
    });

    describe('Pay rent & interest, allow building houses', function() {
      it('should pay the rent', function(done) {
        marketplace.payRents(gameId, function(err) {
          done(err);
        })
      });
    });

    describe('Building houses #4', function () {
      it('should build two houses (4)', function (done) {
        var teamIndex = 0;
        var buildingNbExpected = 4;
        marketplace.buildHouses(gameId, gameData.teams[0].uuid, function (err, info) {
          console.log(info);
          expect(info.amount).to.be(-4500);
          expect(info.log.length).to.be(2);
          // the order is not predictable, try
          var i = 0;
          if (info.log[1].amount === -500) {
            i = 1;
          }
          expect(info.log[i].amount).to.be(-500);
          expect(info.log[i].buildingNb).to.be(buildingNbExpected);
          expect(info.log[i].property).to.be(pricelist[0].uuid);
          expect(info.log[i].propertyName).to.be(pricelist[0].location.name);

          gameData.teams[teamIndex].expectedMoney -= 4500;
          gameData.teams[teamIndex].expectedEntries++;
          done(err);
        });
      });
    });

    describe('Pay rent & interest, allow building houses', function() {
      it('should pay the rent', function(done) {
        marketplace.payRents(gameId, function(err) {
          done(err);
        })
      });
    });

    describe('Building houses #5 (Hotel)', function () {
      it('should build two houses (5)', function (done) {
        var teamIndex = 0;
        var buildingNbExpected = 5;
        marketplace.buildHouses(gameId, gameData.teams[0].uuid, function (err, info) {
          console.log(info);
          expect(info.amount).to.be(-4500);
          expect(info.log.length).to.be(2);
          // the order is not predictable, try
          var i = 0;
          if (info.log[1].amount === -500) {
            i = 1;
          }
          expect(info.log[i].amount).to.be(-500);
          expect(info.log[i].buildingNb).to.be(buildingNbExpected);
          expect(info.log[i].property).to.be(pricelist[0].uuid);
          expect(info.log[i].propertyName).to.be(pricelist[0].location.name);

          gameData.teams[teamIndex].expectedMoney -= 4500;
          gameData.teams[teamIndex].expectedEntries++;

          teamAccount.getBalance(gameId, gameData.teams[teamIndex].uuid, function (err, info) {
            expect(info.balance).to.be(gameData.teams[teamIndex].expectedMoney);
            expect(info.entries).to.be(gameData.teams[teamIndex].expectedEntries);

            teamAccount.getAccountStatement(gameId, gameData.teams[teamIndex].uuid, function (err, data) {
              expect(data.length).to.be(gameData.teams[teamIndex].expectedEntries);
              console.log(data);
              var lastEntry = _.last(data);
              expect(lastEntry.transaction.parts.length).to.be(2);
              expect(lastEntry.transaction.parts[1].propertyName.length).to.be.above(1);
              expect(lastEntry.transaction.parts[1].property.length).to.be.above(16);
              expect(lastEntry.transaction.parts[1].buildingNb).to.be(buildingNbExpected);
              expect(lastEntry.transaction.parts[1].amount).to.be.lessThan(0);
              expect(lastEntry.transaction.amount).to.be(-4500);
            });
            done(err);
          });
        });
      });
    });

    describe('Pay rent & interest, allow building houses', function() {
      it('should pay the rent', function(done) {
        marketplace.payRents(gameId, function(err) {
          done(err);
        })
      });
    });

    describe('Building houses #6 (Hotel++???)', function () {
      it('should build build nothing', function (done) {
        var teamIndex = 0;
        var buildingNbExpected = 5;
        marketplace.buildHouses(gameId, gameData.teams[0].uuid, function (err, info) {
          console.log(info);
          expect(info.amount).to.be(0);
          expect(info.log).to.be(undefined);
          gameData.teams[teamIndex].expectedMoney -= 0;
          gameData.teams[teamIndex].expectedEntries -= 0;

          teamAccount.getBalance(gameId, gameData.teams[teamIndex].uuid, function (err, info) {
            expect(info.balance).to.be(gameData.teams[teamIndex].expectedMoney);
            expect(info.entries).to.be(gameData.teams[teamIndex].expectedEntries);

            teamAccount.getAccountStatement(gameId, gameData.teams[teamIndex].uuid, function (err, data) {
              expect(data.length).to.be(gameData.teams[teamIndex].expectedEntries);
              var lastEntry = _.last(data);
              expect(lastEntry.transaction.parts.length).to.be(2);
              expect(lastEntry.transaction.parts[1].propertyName.length).to.be.above(1);
              expect(lastEntry.transaction.parts[1].property.length).to.be.above(16);
              expect(lastEntry.transaction.parts[1].buildingNb).to.be(buildingNbExpected);
              expect(lastEntry.transaction.parts[1].amount).to.be.lessThan(0);
              expect(lastEntry.transaction.amount).to.be(-4500);
            });
            done(err);
          });
        });
      });
    });
  });
});