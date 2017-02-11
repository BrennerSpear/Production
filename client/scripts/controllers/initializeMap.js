/**
  * @class initializeMap
  * @description Controller for Google Maps. Makes use of databaseAndAuth factory in order to retrieve/update chat messages from the databse. Listens for any changes in $rootScope (broadcasted by services), and then takes in the new (broadcasted) data and applies it to $scope
*/

angular.module('myApp').controller('initializeMap', function($rootScope, $scope, databaseAndAuth, coordinateCalc, foursquare, NgMap) {



  $scope.$on('user:updatedOrAdded', function(event, data) {
    $scope.userLocations[data[0]] = data[1];
    updateCenterPointAndRadius();

    databaseAndAuth.database.ref('/foursquare_results').once('value').then(function(snapshot) {
      $scope.foursquareLocations = [];
      for (key in snapshot.val()) {
        $scope.foursquareLocations.push(snapshot.val()[key]);
      }
    });
    
    // console.log('foursquare array', $scope.foursquareLocations);
    // console.log('foursquare location latitude', $scope.foursquareLocations[0].venue.location.lat);
    $scope.$apply();
  });

  $scope.$on('user:loggedOut', function(event, data) {
    $scope.userLocations = undefined; 
    $scope.$apply();
  });

  $scope.$on('user:logIn', function(event, data) {
    $scope.userLocations = databaseAndAuth.users;
    $scope.$apply();
  });

  // This is the function that sucks - getting called four times.
  NgMap.getMap().then(function(map) {
    console.log('in NgMap then function')
    // Handle rendering markers on the map for current Foursquare data in Firebase
    retrieveFoursquareLocations().then(function(foursquareLocations) {
      foursquareLocations.forEach((location, index) => {
        // Add a marker on the map for each foursquare location
        setTimeout(function() {
          var marker = new google.maps.Marker({
            position: new google.maps.LatLng(location.venue.location.lat, location.venue.location.lng),
            map: map,
            draggable: false,
            animation: google.maps.Animation.DROP,
            name: location.venue.name
          });
          var overlay = new CustomMarker(
            new google.maps.LatLng(location.venue.location.lat, location.venue.location.lng), 
            map,
            {
              marker_id: location.venue.name,
              innerHTML: '<p class="location-label">' + location.venue.name + '</p>'
            }
          );
          marker.addListener('click', clickLocation);
        }, index * 200);
      })
    })

    // Handle putting directions on the map
    var directionsService = new google.maps.DirectionsService;
    var directionsDisplay = new google.maps.DirectionsRenderer;
    directionsDisplay.setMap(map);
    calculateAndDisplayRoute(directionsService, directionsDisplay);

  });

  // Function that calculates a route on the map
  function calculateAndDisplayRoute(directionsService, directionsDisplay) {
    directionsService.route({
      origin: '944 Market Street, 8th floor, San Francisco, CA 94102',
      destination: 'Embarcadero Center, San Francisco, CA',
      travelMode: 'DRIVING'
    }, function(response, status) {
      if (status === 'OK') {
        directionsDisplay.setDirections(response);
      } else {
        console.log('Directions request failed due to ' + status);
      }
    });
  } 

  // Function that fires when user clicks on a map marker
  var clickLocation = function() {
    console.log(this.name);
  }

  // Create a promise that returns an array of foursquare locations currently in Firebase
  var retrieveFoursquareLocations = function() {
    return databaseAndAuth.database.ref('/foursquare_results').once('value').then(function(snapshot) {
      foursquareLocations = [];
      for (key in snapshot.val()) {
        foursquareLocations.push(snapshot.val()[key]);
      }
      return foursquareLocations;
    });
  }

  // Recalculate the search coordinates for the map
  var updateCenterPointAndRadius = function() {
    coordinateCalc.getUserLocationData().then(function(coordinates) {
      circleData = coordinateCalc.calculateCircle(coordinates);
      
      $scope.avgLat = circleData.midpointLat;
      $scope.avgLon = circleData.midpointLon;
      $scope.radius = circleData.radius;

      databaseAndAuth.database.ref('/search_radius').set({
        midpointLat: circleData.midpointLat,
        midpointLon: circleData.midpointLon,
        radius: circleData.radius
      })

      // renderLocationsonMap();

      // console.log('LOCATIONS', $scope.foursquareLocations)
      // console.log('updating search circle', $scope.avgLat, $scope.avgLon, $scope.radius);
    })
  }


  // Create some new functionality for Google Maps Custom Markers
  function CustomMarker(latlng, map, args) {
    this.latlng = latlng; 
    this.args = args; 
    this.setMap(map); 
  }

  CustomMarker.prototype = new google.maps.OverlayView();

  CustomMarker.prototype.draw = function() {
    
    var self = this;
    
    var div = this.div;
    
    if (!div) {
    
      div = this.div = document.createElement('div');

      div.className = 'marker-label';
      div.style.position = 'absolute';
      div.style.cursor = 'pointer';
      div.style.height = '20px';
      
      if (typeof(self.args.innerHTML) !== 'undefined') {
        div.innerHTML = self.args.innerHTML;
      }

      if (typeof(self.args.marker_id) !== 'undefined') {
        div.dataset.marker_id = self.args.marker_id;
      }
      
      // Add an on click event to the name on the marker
      google.maps.event.addDomListener(div, "click", function(event) {      
        console.log(this.dataset.marker_id);
      });
      
      var panes = this.getPanes();
      panes.overlayImage.appendChild(div);
    }
    
    var point = this.getProjection().fromLatLngToDivPixel(this.latlng);
    
    if (point) {
      div.style.left = (point.x) + 'px';
      div.style.top = (point.y - 35) + 'px';
    }
  };

  CustomMarker.prototype.remove = function() {
    if (this.div) {
      this.div.parentNode.removeChild(this.div);
      this.div = null;
    } 
  };

  CustomMarker.prototype.getPosition = function() {
    return this.latlng; 
  };




});