#!/usr/bin/env node

"use strict";

var path = require("path"),
    util = require("util");

var async = require("async"),
    env = require("require-env"),
    request = require("crequest");

// TODO make units configurable
var MAPQUEST_URL = util.format("http://open.mapquestapi.com/elevation/v1/profile?key=%s&unit=f",
                               env.require("MAPQUEST_API_KEY"));

var getGeometries = function(data) {
  switch (data.type) {
  case "FeatureCollection":
    return data.features.map(function(x) {
      return x.geometry;
    });

  case "Feature":
    return [data.geometry];

  default:
    throw new Error("Unsupported GeoJSON type: " + data.type);
  }
};

process.argv.slice(2).forEach(function(filename) {
  var data = require(path.join(process.cwd(), filename));

  var geometries = getGeometries(data);

  return async.each(geometries, function(geometry, done) {
    var latLng = geometry.coordinates
      .map(function(x) {
        // GeoJSON is x,y, MapQuest expects lat,lng
        return x.slice().reverse();
      })
      .map(function(x) {
        return x.join(",");
      }).join(",");

    return request.post({
      url: MAPQUEST_URL,
      form: {
        latLngCollection: latLng
      }
    }, function(err, res, body) {
      if (err) {
        return done(err);
      }

      var profile = body.elevationProfile;

      if (profile.length !== geometry.coordinates.length) {
        return done(new Error(util.format("Point counts don't match: %d/%d.",
                                              geometry.coordinates.length,
                                              profile.length)));
      }

      // add height as Z, distance as M
      geometry.coordinates = geometry.coordinates.map(function(coords, i) {
        var d = profile[i];
        coords.push(d.height, d.distance);

        return coords;
      });

      return done(null, geometry.coordinates);
    });
  }, function(err) {
    if (err) {
      console.error(err);
      return;
    }

    console.log("%j", data);
  });
});
