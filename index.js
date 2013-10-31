#!/usr/bin/env node

"use strict";

var path = require("path"),
    util = require("util");

var async = require("async"),
    request = require("crequest"),
    optimist = require("optimist")
      .usage("$0 (-k | --key) <MapQuest API key> file [files...]")
      .alias("k", "key"),
    argv = optimist.argv,
    argc = argv._;

var mapQuestKey = argv.key || process.env.MAPQUEST_API_KEY;
if (!mapQuestKey) {
  optimist.showHelp();
  process.exit(1);
}

// TODO make units configurable
var MAPQUEST_URL = util.format("http://open.mapquestapi.com/elevation/v1/profile?key=%s&unit=f", mapQuestKey);

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

argc.forEach(function(filename) {
  // data is a Feature or FeatureCollection
  var data = require(path.join(process.cwd(), filename)),
      heights = [],
      distances = [];

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
        coords[2] = d.height;
        coords[3] = d.distance;
        heights.push(d.height);
        distances.push(d.distance);
        return coords;
      });

      return done(null, geometry.coordinates);
    });
  }, function(err) {
    if (err) {
      console.error(err);
      return;
    }

    if (data.type === "FeatureCollection") {
      data.properties = data.properties || {};
      var ascending = function(a, b) { return a - b; };
      heights.sort(ascending);
      distances.sort(ascending);
      data.properties.heightRange = [heights[0], heights[heights.length - 1]];
      data.properties.distanceRange = [distances[0], distances[distances.length - 1]];
    }

    console.log("%j", data);
  });
});
