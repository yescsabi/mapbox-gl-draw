const CommonSelectors = require('../lib/common_selectors');
const isEventAtCoordinates = require('../lib/is_event_at_coordinates');
const doubleClickZoom = require('../lib/double_click_zoom');
const Constants = require('../constants');
const createVertex = require('../lib/create_vertex');
const lineDistance = require('@turf/line-distance');
const numeral = require('numeral');

const DrawCircle = {};

DrawCircle.onSetup = function(opts) {
  opts = opts || {};
  const featureId = opts.featureId;

  let line, currentVertexPosition;
  let direction = 'forward';
  if (featureId) {
    line = this.getFeature(featureId);
    if (!line) {
      throw new Error('Could not find a feature with the provided featureId');
    }
    let from = opts.from;
    if (from && from.type === 'Feature' && from.geometry && from.geometry.type === 'Point') {
      from = from.geometry;
    }
    if (from && from.type === 'Point' && from.coordinates && from.coordinates.length === 2) {
      from = from.coordinates;
    }
    if (!from || !Array.isArray(from)) {
      throw new Error('Please use the `from` property to indicate which point to continue the line from');
    }
    const lastCoord = line.coordinates.length - 1;
    if (line.coordinates[lastCoord][0] === from[0] && line.coordinates[lastCoord][1] === from[1]) {
      currentVertexPosition = lastCoord + 1;
      // add one new coordinate to continue from
      line.addCoordinate(currentVertexPosition, ...line.coordinates[lastCoord]);
    } else if (line.coordinates[0][0] === from[0] && line.coordinates[0][1] === from[1]) {
      direction = 'backwards';
      currentVertexPosition = 0;
      // add one new coordinate to continue from
      line.addCoordinate(currentVertexPosition, ...line.coordinates[0]);
    } else {
      throw new Error('`from` should match the point at either the start or the end of the provided LineString');
    }
  } else {
    line = this.newFeature({
      type: Constants.geojsonTypes.FEATURE,
      properties: {'subType': 'circle', 'radius': 0},
      geometry: {
        type: Constants.geojsonTypes.LINE_STRING,
        coordinates: []
      }
    });
    currentVertexPosition = 0;
    this.addFeature(line);
  }

  this.clearSelectedFeatures();
  doubleClickZoom.disable(this);
  this.updateUIClasses({ mouse: Constants.cursors.ADD });
  this.activateUIButton(Constants.types.CIRCLE);
  this.setActionableState({
    trash: true
  });

  return {
    line,
    currentVertexPosition,
    direction
  };
};

DrawCircle.clickAnywhere = function(state, e) {
  /*if (state.currentVertexPosition > 0 && isEventAtCoordinates(e, state.line.coordinates[state.currentVertexPosition - 1]) ||
      state.direction === 'backwards' && isEventAtCoordinates(e, state.line.coordinates[state.currentVertexPosition + 1])) {
    return this.changeMode(Constants.modes.SIMPLE_SELECT, { featureIds: [state.line.id] });
  }
  this.updateUIClasses({ mouse: Constants.cursors.ADD });
  state.line.updateCoordinate(state.currentVertexPosition, e.lngLat.lng, e.lngLat.lat);
  if (state.direction === 'forward') {
    state.currentVertexPosition++;
    state.line.updateCoordinate(state.currentVertexPosition, e.lngLat.lng, e.lngLat.lat);
  } else {
    state.line.addCoordinate(0, e.lngLat.lng, e.lngLat.lat);
  }*/

  // this ends the drawing after the user creates a second point, triggering this.onStop
  if (state.currentVertexPosition === 1) {
    state.line.addCoordinate(0, e.lngLat.lng, e.lngLat.lat);
    return this.changeMode(Constants.modes.SIMPLE_SELECT, { featureIds: [state.line.id] });
  }
  this.updateUIClasses({ mouse: Constants.cursors.ADD });
  state.line.updateCoordinate(state.currentVertexPosition, e.lngLat.lng, e.lngLat.lat);
  if (state.direction === 'forward') {
    state.currentVertexPosition += 1; // eslint-disable-line
    state.line.updateCoordinate(state.currentVertexPosition, e.lngLat.lng, e.lngLat.lat);
  } else {
    state.line.addCoordinate(0, e.lngLat.lng, e.lngLat.lat);
  }

  return null;

};

DrawCircle.clickOnVertex = function(state) {
  return this.changeMode(Constants.modes.SIMPLE_SELECT, { featureIds: [state.line.id] });
};

DrawCircle.onMouseMove = function(state, e) {
  state.line.updateCoordinate(state.currentVertexPosition, e.lngLat.lng, e.lngLat.lat);
  if (CommonSelectors.isVertex(e)) {
    this.updateUIClasses({ mouse: Constants.cursors.POINTER });
  }
};

DrawCircle.onTap = DrawCircle.onClick = function(state, e) {
  if (CommonSelectors.isVertex(e)) return this.clickOnVertex(state, e);
  this.clickAnywhere(state, e);
};

DrawCircle.onKeyUp = function(state, e) {
  if (CommonSelectors.isEnterKey(e)) {
    this.changeMode(Constants.modes.SIMPLE_SELECT, { featureIds: [state.line.id] });
  } else if (CommonSelectors.isEscapeKey(e)) {
    this.deleteFeature([state.line.id], { silent: true });
    this.changeMode(Constants.modes.SIMPLE_SELECT);
  }
};

DrawCircle.onStop = function(state) {
  /*doubleClickZoom.enable(this);
  this.activateUIButton();

  // check to see if we've deleted this feature
  if (this.getFeature(state.line.id) === undefined) return;

  //remove last added coordinate
  state.line.removeCoordinate(`${state.currentVertexPosition}`);
  if (state.line.isValid()) {
    this.map.fire(Constants.events.CREATE, {
      features: [state.line.toGeoJSON()]
    });
  } else {
    this.deleteFeature([state.line.id], { silent: true });
    this.changeMode(Constants.modes.SIMPLE_SELECT, {}, { silent: true });
  }*/


  doubleClickZoom.enable(this);
  this.activateUIButton();

  // check to see if we've deleted this feature
  if (this.getFeature(state.line.id) === undefined) return;

  // remove last added coordinate
  state.line.removeCoordinate('0');
  if (state.line.isValid()) {
    const lineGeoJson = state.line.toGeoJSON();
    // reconfigure the geojson line into a geojson point with a radius property
    const pointWithRadius = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: lineGeoJson.geometry.coordinates[0]
      },
      properties: {
        radius: (lineDistance(lineGeoJson) * 1000).toFixed(1)
      }
    };

    this.map.fire(Constants.events.CREATE, {
      features: [pointWithRadius]
    });
  } else {
    this.deleteFeature([state.line.id], { silent: true });
    this.changeMode(Constants.modes.SIMPLE_SELECT, {}, { silent: true });
  }
};

DrawCircle.onTrash = function(state) {
  this.deleteFeature([state.line.id], { silent: true });
  this.changeMode(Constants.modes.SIMPLE_SELECT);
};

function getDisplayMeasurements(feature) {
  // should log both metric and standard display strings for the current drawn feature

  // metric calculation
  const drawnLength = (lineDistance(feature) * 1000); // meters

  let metricUnits = 'm';
  let metricFormat = '0,0';
  let metricMeasurement;

  let standardUnits = 'feet';
  let standardFormat = '0,0';
  let standardMeasurement;

  metricMeasurement = drawnLength;
  if (drawnLength >= 1000) { // if over 1000 meters, upgrade metric
    metricMeasurement = drawnLength / 1000;
    metricUnits = 'km';
    metricFormat = '0.00';
  }

  standardMeasurement = drawnLength * 3.28084;
  if (standardMeasurement >= 5280) { // if over 5280 feet, upgrade standard
    standardMeasurement /= 5280;
    standardUnits = 'mi';
    standardFormat = '0.00';
  }

  const displayMeasurements = {
    metric: `${numeral(metricMeasurement).format(metricFormat)} ${metricUnits}`,
    standard: `${numeral(standardMeasurement).format(standardFormat)} ${standardUnits}`,
};

  return displayMeasurements;
}

function createGeoJSONCircle(center, radiusInKm, parentId, points = 64) {
  const coords = {
    latitude: center[1],
    longitude: center[0],
  };

  const km = radiusInKm;

  const ret = [];
  const distanceX = km / (111.320 * Math.cos((coords.latitude * Math.PI) / 180));
  const distanceY = km / 110.574;

  let theta;
  let x;
  let y;
  for (let i = 0; i < points; i += 1) {
    theta = (i / points) * (2 * Math.PI);
    x = distanceX * Math.cos(theta);
    y = distanceY * Math.sin(theta);

    ret.push([coords.longitude + x, coords.latitude + y]);
  }
  ret.push(ret[0]);

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [ret]
    },
    properties: {
      parent: parentId
    }
  };
}

DrawCircle.toDisplayFeatures = function(state, geojson, display) {
  /*const isActiveLine = geojson.properties.id === state.line.id;
  geojson.properties.active = (isActiveLine) ? Constants.activeStates.ACTIVE : Constants.activeStates.INACTIVE;
  if (!isActiveLine) return display(geojson);
  // Only render the line if it has at least one real coordinate
  if (geojson.geometry.coordinates.length < 2) return;
  geojson.properties.meta = Constants.meta.FEATURE;
  display(createVertex(
    state.line.id,
    geojson.geometry.coordinates[state.direction === 'forward' ? geojson.geometry.coordinates.length - 2 : 1],
    `${state.direction === 'forward' ? geojson.geometry.coordinates.length - 2 : 1}`,
    false
  ));

  display(geojson);*/

  /*console.log('DrawCircle.toDisplayFeatures');
  console.log(geojson);*/


  const isActiveLine = geojson.properties.id === state.line.id;
  geojson.properties.active = (isActiveLine) ? Constants.activeStates.ACTIVE : Constants.activeStates.INACTIVE;

  if (geojson.geometry.coordinates.length >= 2) {
    // create custom feature for radius circlemarker
    const center = geojson.geometry.coordinates[0];
    const radiusInKm = lineDistance(geojson, 'kilometers');
    const circleFeature = createGeoJSONCircle(center, radiusInKm, geojson.properties.id);
    circleFeature.properties.meta = Constants.meta.FEATURE/*'radius'*/;
    circleFeature.properties.active = (isActiveLine) ? Constants.activeStates.ACTIVE : Constants.activeStates.INACTIVE;

    if (isActiveLine) {
      state.line.properties.radius = radiusInKm;
    }

    /*console.log('display circle=' + geojson.properties.id);*/
    display(circleFeature);
  }

  if (!isActiveLine) {
    if (geojson.properties.subType && geojson.properties.subType == 'circle') {
      return;
    }
    return display(geojson);
  }

  // Only render the line if it has at least one real coordinate
  if (geojson.geometry.coordinates.length < 2) return null;
  geojson.properties.meta = Constants.meta.FEATURE;

  /*geojson.properties.subType = 'circle';*/

  // displays center vertex as a point feature
  display(createVertex(
    state.line.id,
    geojson.geometry.coordinates[state.direction === 'forward' ? geojson.geometry.coordinates.length - 2 : 1],
    `${state.direction === 'forward' ? geojson.geometry.coordinates.length - 2 : 1}`,
    false
  ));

  // displays the line as it is drawn
  display(geojson);

  const displayMeasurements = getDisplayMeasurements(geojson);

  // create custom feature for the current pointer position
  const currentVertex = {
    type: 'Feature',
    properties: {
      meta: 'currentPosition',
      radiusMetric: displayMeasurements.metric,
      radiusStandard: displayMeasurements.standard,
      parent: state.line.id,
      active: (isActiveLine) ? Constants.activeStates.ACTIVE : Constants.activeStates.INACTIVE
    },
    geometry: {
      type: 'Point',
      coordinates: geojson.geometry.coordinates[1]
    }
  };
  display(currentVertex);

  return null;
};

module.exports = DrawCircle;
