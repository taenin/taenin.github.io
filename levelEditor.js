

function createWorker(categoryJSON){
  var worker = {};
  worker.canvas = new fabric.Canvas('myCanvas', { selection: true });
  worker.drawData = {};
  worker.objectTypeGenerators = {};
  worker.toolDropMap = {}; //Maps from a subcategory name to its index in drawData[selection].img
  worker.debug = function(canvasObject){
    console.log("Index in state: " + worker.state[canvasObject.categoryType].indexOf(canvasObject));
    console.log("Index in Z levels: " + worker.canvas.getObjects().indexOf(canvasObject));
    console.log("----");
  }

  /******************************************************
  Call this function EVERY TIME we load in a new file!
  ******************************************************/
  worker.refresh = function(){
    //initialize all of the variables we need to start things off
    worker.desiredState = {};
    worker.groupContents = [];
    worker.mousePosition = { "pageX": 0,
                             "pageY": 0};
    worker.grid = 32; //size of a meter in pixels
    worker.gridLines = []; //grid lines
    worker.worldWidth = 64; //width of the world in meters
    worker.worldHeight = 48; //height of the world in meters
    worker.zLevels = {
      "ForegroundLayers": 3,
      "BackgroundLayers": -2,
      "BackgroundAestheticDetails": -1,
      "ForegroundAestheticDetails": 2,
      "Portals": 1, 
    };

    worker.defaultSelectPrompt = "Select an Object";
    worker.imageCount = {}; //Create a mapping from image names to the occurance of their names. Used for tool selection.
    worker.zCounts = {
      "-2": 0,
      "-1": 0,
       "0": 0,
       "1": 0,
       "2": 0,
       "3": 0
    };
    worker.shouldSnapToGrid = function(){
      return $("#snapToGrid").is(":checked");
    }
    //["Spawners", "EnvironmentTiles"];
    worker.hoverImage = null;
    /*
    The hoverImage object has the form:
    {
      'src': 'someimage.png',
      'canvasElement': fabricJSObject,
      'type': "layer" // this should be a category type
    }

    */
    // A list of valid image objects that give the name and location of an image.
    worker.tools = []; 
    worker.state = {
                      "ForegroundLayers": [],
                      "BackgroundLayers": [],
                      "BackgroundAestheticDetails": [],
                      "ForegroundAestheticDetails": [],
                      "AnimatedDetails" : [],
                      "EnvironmentTiles": [],
                      "Avatar": null,
                      "Nodes": [],
                      "Spawners": [],
                      "Enemies": [],
                      "Goal": null,
                      "Hazards": [],
                      "Portals": [],
                      "CheckPoints": []
                   };


    worker.selectDropMap = {}; //Maps from a subcategory name to its 

    //Clear the canvas!
    worker.canvas.clear().renderAll();
    worker.drawHideToggles();
    worker.updateWorldWidth(worker.worldWidth);
    worker.updateWorldHeight(worker.worldHeight, true);
    $("#categorySelect").change();
  }
  
  //Bashes the old avatar state with the new avatar location. We assume there was no previous avatar spawn point.



  //Use this function to update the outputObject for Inari
  worker.setLocation = function(canvasObject, group){
    var zLevel = worker.getZLevel(canvasObject);
    //Check if isGrouped, then only modify the correct properties
    if(group){
      var left = group.left  + canvasObject.left + (group.width/2);
      var top = group.top + canvasObject.top + (group.height/2);
      var fakeCanvasObject = {};
      fakeCanvasObject.width = canvasObject.width;
      fakeCanvasObject.height = canvasObject.height;
      fakeCanvasObject.left = left;
      fakeCanvasObject.top = top;
      if(zLevel != 0){
        //Leave them as raw pixel values
        canvasObject.outputObject.Location = worker.getPixelLocationFromCanvasObject(fakeCanvasObject);
      }
      else{
        //convert to meters
        canvasObject.outputObject.Location = worker.getMeterLocationFromCanvasObject(fakeCanvasObject);
      }
    }
    else{
      if(worker.shouldSnapToGrid()){
        canvasObject.set({
          left: Math.round(canvasObject.left / worker.grid) * worker.grid,
          top: Math.round(canvasObject.top / worker.grid) * worker.grid
        });
        canvasObject.setCoords();
        worker.canvas.renderAll();
      }
      if(zLevel != 0){
        //Leave them as raw pixel values
        canvasObject.outputObject.Location = worker.getPixelLocationFromCanvasObject(canvasObject);
      }
      else{
        //convert to meters
        canvasObject.outputObject.Location = worker.getMeterLocationFromCanvasObject(canvasObject);
      }
      if(worker.canvas.getActiveObject() == canvasObject){
        $("#inari_Location_X").val(canvasObject.outputObject.Location.X);
        $("#inari_Location_Y").val(canvasObject.outputObject.Location.Y);
      }
    }
  }

  //Use this function to update the drawing on the canvas
  worker.updateLocation = function(canvasObject){
    var zLevel = worker.getZLevel(canvasObject);
    if(zLevel != 0){
      //We're translating from pixel values
      newLocation = worker.getCanvasLocationFromPixelLocation(canvasObject.outputObject.Location, canvasObject);
      canvasObject.left = newLocation.left;
      canvasObject.top  = newLocation.top;
    }
    else{
      //We're translating from meters
      newLocation = worker.getCanvasLocationFromMeterLocation(canvasObject.outputObject.Location, canvasObject);
      canvasObject.left = newLocation.left;
      canvasObject.top  = newLocation.top;
    }
    if(worker.shouldSnapToGrid()){
      //Update the text boxes
      worker.setLocation(canvasObject);
    }
    else{
      canvasObject.setCoords();
      worker.canvas.renderAll();
    }
  }

  worker.generateDefaultObject = function(canvasObject){
    output = {}
    if(worker.objectTypeGenerators.hasOwnProperty(canvasObject.categoryType)){
      output = worker.objectTypeGenerators[canvasObject.categoryType](canvasObject);
    }
    return output;
  }

  worker.generateDropDownID = function(imgString){
    //Assume the file extension is always .*** = 4 characters
    key = imgString.slice(0, -4)
    if(!worker.imageCount.hasOwnProperty(key)){
      worker.imageCount[key] = 0;
    }
    return key + worker.imageCount[key];
  }

  worker.updateDropDownID = function(imgString){
    key = imgString.slice(0, -4);
    if(worker.imageCount.hasOwnProperty(key)){
      worker.imageCount[key] += 1;
    }
  }

  worker.moveDownZLevel = function(canvasObject){
    currentPosition = worker.canvas.getObjects().indexOf(canvasObject);
    zLevel = worker.getZLevel(canvasObject);
    positions = 0;
    //positions += worker.gridLines.length;
    for(var key in worker.zCounts){
      if(key < zLevel && worker.zCounts.hasOwnProperty(String(key))){
        positions += worker.zCounts[String(key)];
      }
    }
    if(positions < currentPosition && zLevel!=0){
      worker.canvas.moveTo(canvasObject, currentPosition-1);
      if(worker.state.hasOwnProperty(canvasObject.categoryType)){
        worker.arraySwap(worker.state[canvasObject.categoryType], currentPosition-positions, currentPosition - positions -1);
      }
    }
  }

  worker.moveUpZLevel = function(canvasObject){
    var currentPosition = worker.canvas.getObjects().indexOf(canvasObject);
    var zLevel = worker.getZLevel(canvasObject);
    var positions = -1;
    //positions += worker.gridLines.length;
    for(var key in worker.zCounts){
      if(key <= zLevel && worker.zCounts.hasOwnProperty(String(key))){
        positions += worker.zCounts[String(key)];
      }
    }
    if(positions > currentPosition && zLevel!=0){
      worker.canvas.moveTo(canvasObject, currentPosition+1);
      if(worker.state.hasOwnProperty(canvasObject.categoryType)){
        worker.arraySwap(worker.state[canvasObject.categoryType], (worker.zCounts[zLevel] -1 - (positions - 1 - currentPosition)), (worker.zCounts[zLevel] -1 - (positions - currentPosition)));
      }
    }
  }

  worker.arraySwap = function(targetArray, indA, indB){
    temp = targetArray[indA];
    targetArray[indA] = targetArray[indB];
    targetArray[indB] = temp;
  }

  worker.getZLevel = function(canvasObject){
    return worker.getZLevelFromCategory(canvasObject.categoryType);
  }

  worker.getZLevelFromCategory = function(category){
    if(worker.zLevels.hasOwnProperty(category)){
      return worker.zLevels[category];
    }
    else{
      return 0;
    }
  }

  worker.removeObject = function(canvasObject){
    worker.canvas.remove(canvasObject);
    var zLevel = worker.getZLevel(canvasObject);
    if(Object.prototype.toString.call( worker.state[canvasObject.categoryType] ) === "[object Array]"){
      if(worker.state.hasOwnProperty(canvasObject.categoryType)){
        var targetIndex = worker.state[canvasObject.categoryType].indexOf(canvasObject);
        if(targetIndex>-1){
          worker.state[canvasObject.categoryType].splice(targetIndex, 1);
          if(worker.zCounts.hasOwnProperty(String(zLevel))){
            worker.zCounts[String(zLevel)] -=1;
          }
        }
      }
    }
    else{
      if(worker.state.hasOwnProperty(canvasObject.categoryType)){
        if(worker.zCounts.hasOwnProperty(String(zLevel))){
            worker.zCounts[String(zLevel)] -=1;
        }
        worker.state[canvasObject.categoryType] = null;
      }

    }
  }

  worker.addObject = function(canvasObject){
    var zLevel = worker.getZLevel(canvasObject);
    if(worker.state.hasOwnProperty(canvasObject.categoryType)){
      //canvasObject.outputObject = worker.generateDefaulfObject(canvasObject);
      var positions = 0;
      //positions += worker.gridLines.length;
      for(var key in worker.zCounts){
        if(key <= zLevel && worker.zCounts.hasOwnProperty(String(key))){
          positions += worker.zCounts[String(key)];
        }
      }
      if(Object.prototype.toString.call( worker.state[canvasObject.categoryType] ) === "[object Array]"){
        worker.state[canvasObject.categoryType].push(canvasObject);
        if(worker.zCounts.hasOwnProperty(String(zLevel))){
          worker.zCounts[String(zLevel)] +=1;
        }
      }
      else{
        if(worker.zCounts.hasOwnProperty(String(zLevel)) && !worker.state[canvasObject.categoryType]){
          worker.zCounts[String(zLevel)] +=1;
        }
        else{
          worker.canvas.remove(worker.state[canvasObject.categoryType]);
        }
        worker.state[canvasObject.categoryType] = canvasObject;
      }
      worker.canvas.moveTo(canvasObject, positions);
    }
  }

  worker.redrawSelection = function(){
    fabric.Image.fromURL(worker.hoverImage.src, function(oImg){
          oImg.dropDownID = worker.generateDropDownID(worker.hoverImage.src);
          oImg.imgSource = worker.hoverImage.src;
          oImg.categoryType = worker.hoverImage.type;
          oImg.lockScalingX = true; //make it so we cannot resize the images
          oImg.lockScalingY = true;
          worker.hoverImage.canvasElement = oImg;
          oImg.outputObject = worker.generateDefaultObject(oImg);
          //worker.setLocation(oImg);
          if(oImg.outputObject.hasOwnProperty("PlistSource")){
            worker.updatePList(oImg.outputObject.PlistSource, oImg);
          }
          worker.canvas.add(oImg); 
          worker.drawOnMouseMove(worker.mousePosition);
        }); 
  }

  worker.updateSelectDropDown = function(canvasObject){
    $("#categorySelect").val(canvasObject.categoryType).change();
    $("#subcategorySelect").val(canvasObject.dropDownID).change();
  }

  worker.initializeCanvasHandlers = function(){
    $('html').keyup(function(e){
      //Check for the delete key
      var selectedObject = worker.canvas.getActiveObject();
      var selectedGroup = worker.canvas.getActiveGroup();
      if(e.keyCode == 46 && selectedObject) {
          worker.removeObject(selectedObject);
          $("#categorySelect").change();
      }
      else if(e.keyCode == 46 && selectedGroup){
          objectList = selectedGroup.getObjects();
          worker.canvas.deactivateAll().renderAll();
          for(var i = 0; i < objectList.length; i++){
            worker.removeObject(objectList[i]);
          }
          $("#categorySelect").change();
      }
    });

    worker.canvas.on('object:moving', function(options) {
      if(options.target._objects){
        worker.groupContents = options.target._objects;
        //Snap the selection to grid
        if(worker.shouldSnapToGrid()){
          options.target.set({
            left: Math.round(options.target.left / worker.grid) * worker.grid,
            top: Math.round(options.target.top / worker.grid) * worker.grid
          });
        }
        for(var i = 0; i<options.target._objects.length; i++){
          worker.setLocation(options.target._objects[i], options.target);
        }
      }
      else{
        worker.setLocation(options.target);
      }
    });

    worker.canvas.on('object:selected', function(options) {
      var selectedObject = worker.canvas.getActiveObject();
      var selectedGroup = worker.canvas.getActiveGroup();
      if(selectedObject){
        //This means that only one object is selected rather than a group
        if(worker.hoverImage){
          //worker.deselect();
          worker.addObject(selectedObject);
          worker.updateDropDownID(selectedObject.imgSource);
          worker.redrawSelection();

        }
        $("#categorySelect").val(selectedObject.categoryType);
        categorySelectRedraw();
        
        //$("#categorySelect").change();
        $("#subcategorySelect").val(selectedObject.dropDownID);
        //$("#subcategorySelect").change();
        worker.drawSelection();
      }
      else if(selectedGroup){

      }
        
    });


    worker.canvas.on('selection:cleared', function(options) {
      if(worker.shouldSnapToGrid() && worker.groupContents.length > 0){
        for(var i = 0; i<worker.groupContents.length; i++){
          worker.groupContents[i].set({
            left: Math.round(worker.groupContents[i].left / worker.grid) * worker.grid,
            top: Math.round(worker.groupContents[i].top / worker.grid) * worker.grid
          });
          worker.setLocation(worker.groupContents[i]);
        }    
      }
        
      $("#categorySelect").change();
    });

    $("#canvas").mouseleave(function(){
      if (worker.hoverImage){
        worker.canvas.remove(worker.hoverImage.canvasElement);
        worker.hoverImage.canvasElement = null;
      }
    });
    $("#canvas").mouseenter(function(){
      if(worker.hoverImage){
        worker.redrawSelection();
      }
    });

    $("#canvas").mousemove(function(e){
      worker.mousePosition.pageX = e.pageX;
      worker.mousePosition.pageY = e.pageY;
      //Moving the object along with mouse cursor
      worker.drawOnMouseMove(worker.mousePosition);
      });

    /*$("#canvas").click(function(e){
      if(worker.hoverImage){
        worker.deselect();
        var selectedObject = worker.canvas.getActiveObject()
        if(selectedObject){
          console.log("adding");
          worker.addObject(selectedObject);
          worker.updateDropDownID(selectedObject.imgSource);
        }
      }
    });*/

    $("#slider").slider({
      min: 10,
      max: 100,
      value: 100,
      slide: function(event, ui){
        worker.canvas.setZoom(ui.value / 100);
      }
    });
  }

  worker.initializeWorldControls = function(){
    $("#worldWidth").keyup(function(event){
      if(event.keyCode == 13 && !isNaN(Number($(this).val()))){
        worker.updateWorldWidth(Number($(this).val()));
      }
    });
    $("#worldHeight").keyup(function(event){
      if(event.keyCode == 13 && !isNaN(Number($(this).val()))){
        worker.updateWorldHeight(Number($(this).val()));
      }
    });
  }

  worker.drawOnMouseMove = function(e){
    if (worker.hoverImage && worker.hoverImage.canvasElement) {
          worker.hoverImage.canvasElement.left = ((e.pageX + $('#canvas').scrollLeft() - $('#canvas').offset().left)/worker.canvas.getZoom()) - worker.hoverImage.canvasElement.width /2;
          worker.hoverImage.canvasElement.top = ((e.pageY + $('#canvas').scrollTop() - $('#canvas').offset().top)/ worker.canvas.getZoom()) - worker.hoverImage.canvasElement.height /2 ;
          if(worker.shouldSnapToGrid()){
            worker.hoverImage.canvasElement.left = worker.snapToGrid(worker.hoverImage.canvasElement.left);
            worker.hoverImage.canvasElement.top = worker.snapToGrid(worker.hoverImage.canvasElement.top);
          }
          worker.hoverImage.canvasElement.setCoords();
          if(worker.hoverImage.canvasElement.outputObject){
            if(worker.getZLevel(worker.hoverImage.canvasElement) !=0){
              worker.hoverImage.canvasElement.outputObject.Location = worker.getPixelLocationFromCanvasObject(worker.hoverImage.canvasElement);
            }
            else{
              worker.hoverImage.canvasElement.outputObject.Location = worker.getMeterLocationFromCanvasObject(worker.hoverImage.canvasElement);
            }
          }
          
          worker.canvas.renderAll();
        }
  }

  worker.updateWorldHeight = function(val, repopulating){
    $("#worldHeight").val(val);
    var oldHeight = worker.worldHeight;
    worker.worldHeight = val;
    worker.canvas.setHeight(worker.convertMetersToPixels(val));
    var delta = worker.convertMetersToPixels(val - oldHeight);
    worker.redrawLines();
    //Need to update the Y coordinates of every drawn element
    for(var category in worker.state){
      if(worker.state.hasOwnProperty(category)){
        if(Object.prototype.toString.call( worker.state[category] ) === "[object Array]" && worker.state[category].length > 0){
          for(var i =0; i < worker.state[category].length; i++){
            if(!repopulating){
              worker.state[category][i].top += delta;
            }
            worker.setLocation(worker.state[category][i]);
          }
        }
        else if(Object.prototype.toString.call( worker.state[category] ) === "[object Object]" && worker.state[category]){
          if(!repopulating){
              worker.state[category].top += delta;
          }
          worker.setLocation(worker.state[category]);
        }
      }
    }
  }

  worker.updateWorldWidth = function(val){
    $("#worldWidth").val(val);
    worker.worldWidth = val;
    worker.canvas.setWidth(worker.convertMetersToPixels(val));
    worker.redrawLines();
  }

  worker.redrawLines = function(){
    for (var i = 0; i< worker.gridLines.length; i++){
      worker.canvas.remove(worker.gridLines[i]);
    }
    worker.gridLines = [];
    var height = worker.convertMetersToPixels(worker.worldHeight);
    var width = worker.convertMetersToPixels(worker.worldWidth);
    for (var i = 0; i <= (height / worker.grid); i++) {
      var line = new fabric.Line([ 0, i * worker.grid, width, i * worker.grid], { stroke: '#000', selectable: false, opacity: 0.5 });
      worker.gridLines.push(line);
      worker.canvas.add(line);
      line.bringToFront();
    }
    for (var i = 0; i<= (width / worker.grid); i++){
      var line = new fabric.Line([ i * worker.grid, 0, i * worker.grid, height], { stroke: '#000', selectable: false, opacity: 0.5 });
      worker.gridLines.push(line);
      worker.canvas.add(line);
      line.bringToFront();
    }
  }

  worker.convertMetersToPixels = function(val){
    return val * worker.grid;
  };

  worker.getTypeFromCanvasObject = function(canvasObject){
    return canvasObject.imgSource.slice(0, -4);
  }
  worker.getPixelLocationFromCanvasObject = function(canvasObject){
    //Return the lower left-hand corner of the object
    var location = {};
    location["X"] = canvasObject.left;
    location["Y"] = worker.convertMetersToPixels(worker.worldHeight) - canvasObject.top - canvasObject.height;
    return location;
  }

  worker.getMeterLocationFromCanvasObject = function(canvasObject){
    //Return the lower left-hand corner of the object
    var location = {};
    location["X"] = worker.convertPixelsToMeters(canvasObject.left);
    location["Y"] = worker.worldHeight - worker.convertPixelsToMeters(canvasObject.top + canvasObject.height);
    return location;
  }

  worker.getCanvasLocationFromMeterLocation = function(meterLoc, canvasObject){
    var location = {};
    location["left"] = worker.convertMetersToPixels(meterLoc.X);
    location["top"] = worker.convertMetersToPixels(worker.worldHeight) - worker.convertMetersToPixels(meterLoc.Y) - canvasObject.height;
    return location;
  }

  worker.getCanvasLocationFromPixelLocation = function(pixelLoc, canvasObject){
    var location = {};
    location["left"] = pixelLoc.X;
    location["top"] = worker.convertMetersToPixels(worker.worldHeight) - pixelLoc.Y - canvasObject.height;
    return location;
  }

  worker.convertPixelsToMeters = function(val){
    return val / worker.grid;
  };


  worker.createAvatar = function(canvasObject){
    var avatar = {
                  "Width": canvasObject.width,
                  "Height": canvasObject.height,
                  "PNGSource": canvasObject.imgSource,
                  "Location" : worker.getMeterLocationFromCanvasObject(canvasObject)
                  };
    return avatar;
  };

  worker.createAnimatedDetail = function(canvasObject){
    var detail = {
                "SpriteSheet": canvasObject.imgSource,
                "PNGSource": canvasObject.imgSource,
                "Width": canvasObject.width,
                "Height": canvasObject.height,
                "Location": worker.getPixelLocationFromCanvasObject(canvasObject),
                "GoalLocation": worker.getMeterLocationFromCanvasObject(canvasObject),
                "ShowCheckmark": true,
                "Radius": 0.0,
                "UseRadius": false,
                "InvertRadius": false,
                "LoopAfterCompletion": false,
                "TriggerOnRight": true
    };
    return detail;
  }

  worker.createCheckPoint = function(canvasObject){
    var detail = {
                "PNGSource": canvasObject.imgSource,
                "Width": canvasObject.width,
                "Height": canvasObject.height,
                "Location": worker.getMeterLocationFromCanvasObject(canvasObject),
                "DrawDepth" : 1,
    };
    return detail;
  }

  worker.createPortal = function(canvasObject){
    var portal = {
                  "Width": canvasObject.width,
                  "Height" : canvasObject.height,
                  "PNGSource" : canvasObject.imgSource,
                  "Location" : worker.getPixelLocationFromCanvasObject(canvasObject),
                  "DrawDepth" : 1,
                  "LevelTarget" : "levels/leveName.json"
                 };
   return portal;
  };


  worker.createReceptacle = function(canvasObject){
    var receptacle = {
                    "Width" : canvasObject.width,
                    "Height" : canvasObject.height,
                    "PNGSource" : canvasObject.imgSource,
                    "Location" : worker.getMeterLocationFromCanvasObject(canvasObject),
                    "drawDepth" : 0,
                    "targetChild" : {},
                    "active" : false //Active means the wall is down
    };
    Object.defineProperty(receptacle, "targetChild", {
      enumerable: false,
      writable: true
    });
    return receptacle;
  };

  worker.createReceptacleWall = function(canvasObject){
    var wall = worker.createTile(canvasObject);
    wall.targetParent = {};
    Object.defineProperty(wall, "targetParent", {
      enumerable: false,
      writable: true
    });
    return wall;
  };

  worker.createGoal = function(canvasObject){
    var goal = {
                  "PNGSource": canvasObject.imgSource,
                  "Width": canvasObject.width,
                  "Height": canvasObject.height,
                  "Location": worker.getMeterLocationFromCanvasObject(canvasObject)
                  };
    return goal;
  }

  worker.createBackgroundAestheticDetail = function(canvasObject){
    var detail = {
                "DrawDepth": -1,
                "PNGSource": canvasObject.imgSource,
                "Width": canvasObject.width,
                "Height": canvasObject.height,
                "Location": worker.getPixelLocationFromCanvasObject(canvasObject),
    };
    return detail;
  }

  worker.createForegroundAestheticDetail = function(canvasObject){
    var detail = {
                "DrawDepth": 1,
                "PNGSource": canvasObject.imgSource,
                "Width": canvasObject.width,
                "Height": canvasObject.height,
                "Location": worker.getPixelLocationFromCanvasObject(canvasObject),
    };
    return detail;
  }

  worker.createSpawner = function(canvasObject){
    newSpawner = {
                "PNGSource": canvasObject.imgSource,
                "PlistSource": worker.imgToPlist(canvasObject.imgSource),
                "Type": worker.getTypeFromCanvasObject(canvasObject),
                "Width": canvasObject.width,
                "Height": canvasObject.height,
                "Location": worker.getMeterLocationFromCanvasObject(canvasObject),
                "Boundable": false,
                "Collidable": true,
                "ObeysPhysics": true,
                "Velocity": {
                              "X": 0,
                              "Y": 0
                            },
                "Fancy": false,
                "Delay": 0,
                "SpawnRate": 1,
                "Angle": 0,
                "flipHorizontal": false,
                "flipVertical" : false
    };
    return newSpawner;
  };

  worker.createEnemy = function(canvasObject){
    newEnemy = {
                "PNGSource": canvasObject.imgSource,
                "Type":  worker.getTypeFromCanvasObject(canvasObject),
                "Width": canvasObject.width,
                "Height": canvasObject.height,
                "Location": worker.getMeterLocationFromCanvasObject(canvasObject),
                "Boundable": false,
                "Collidable": true,
                "ObeysPhysics": true,
                "Velocity": {
                              "X": 0,
                              "Y": 0
                            },
                "MaxVelocity": {
                              "X": 0,
                              "Y": 0
                            }
    };
    return newEnemy;
  };

  worker.createBackgroundLayer = function(canvasObject){
    newLayer = {
                "DrawDepth": -2,
                "PNGSource": canvasObject.imgSource,
                "Width": canvasObject.width,
                "Height": canvasObject.height,
                "Location": worker.getPixelLocationFromCanvasObject(canvasObject),
                "ParallaxRates": {
                  "X": 0.0,
                  "Y": 0.0}
    };
    return newLayer;
  };

  worker.createForegroundLayer = function(canvasObject){
    newLayer = {
                "DrawDepth": 2,
                "PNGSource": canvasObject.imgSource,
                "Width": canvasObject.width,
                "Height": canvasObject.height,
                "Location": worker.getPixelLocationFromCanvasObject(canvasObject),
                "ParallaxRates": {
                  "X": 0.0,
                  "Y": 0.0}
    };
    return newLayer;
  };

  worker.createHazard = function(canvasObject){
    newHazard = {
      "PNGSource": canvasObject.imgSource,
      "PlistSource": worker.imgToPlist(canvasObject.imgSource),
      "Type" : worker.getTypeFromCanvasObject(canvasObject),
      "Width": canvasObject.width,
      "Height": canvasObject.height,
      "Location": worker.getMeterLocationFromCanvasObject(canvasObject),
      "Boundable": false,
      "ObeysPhysics": true
    }
    return newHazard;
  }

  worker.createNode = function(canvasObject){
    newNode = {
                "PNGSource": canvasObject.imgSource,
                "Type":  worker.getTypeFromCanvasObject(canvasObject),
                "Width": canvasObject.width,
                "Height": canvasObject.height,
                "Location": worker.getMeterLocationFromCanvasObject(canvasObject),
                "Boundable": true,
                "Collidable": false,
                "ObeysPhysics": false,
                "EndLocation": {
                              "X": 0,
                              "Y": 0
                            },
                "Moves": false,
                "Velocity": 1.0
    };
    return newNode;
  }
  worker.imgToPlist = function(imgSrc){
    var splitList = imgSrc.split("/");
    var newSrc = splitList[splitList.length-1];
    var dot = newSrc.indexOf('.');
    return "/plists/" + newSrc.slice(0, dot) + ".json";
  }

  worker.createTile = function(canvasObject){
    newTile = {
                "PNGSource": canvasObject.imgSource,
                "PlistSource": worker.imgToPlist(canvasObject.imgSource),
                "Width": canvasObject.width,
                "Height": canvasObject.height,
                "Location": worker.getMeterLocationFromCanvasObject(canvasObject),
                "Breakable": false
    };
    return newTile;
  };

  worker.removeTile = function(tileObject){
    this.genericRemoveItemFromList(this.state.EnvironmentTiles, tileObject);
  }
  //This on removes a layer from the list passed in. This does NOT modify the canvas. 
  worker.removeLayer = function(removalList, layerObject){
    this.genericRemoveItemFromList(removalList, layerObject);
  };

  //A simple method for removing items from lists
  worker.genericRemoveItemFromList = function(removalList, itemToRemove){
    targetIndex = removalList.indexOf(itemToRemove); 
    if(targetIndex > -1){
      //Remove the element from the list in place.
      removalList.splice(targetIndex, 1);
    }
  };

  worker.addToDropDown = function(dropDownID, newValue){
    $(dropDownID).append('<option value="' + newValue +'">' + newValue + '</option>');
  };

  worker.removeFromDropDown = function(dropDownID, oldValue){
    $(dropDownID + " option[value='" + oldValue + "']").remove();
  };

  worker.removeAllOptions = function(dropDownID){
    $(dropDownID)
    .find('option')
    .remove()
  };

  worker.addChangeHandler = function(targetID, closure){
    $(targetID).change(closure);
  };

  worker.drawTools = function(){
      $(".toolPopulateCanvas").remove();
      if(worker.tools.length > 0){
        var main = $(document.createElement('div')).addClass("toolPopulateCanvas");
        
        for(var ind = 0; ind<worker.tools.length; ind++){
          latestTile = $(document.createElement('div')).addClass("selectable").append("<img class='image' src=" + worker.tools[ind]  + ">");
          tileClickHandler(latestTile);
          main.append(latestTile);
        }
        $(".toolPopulate").append(main);
      }
      
    };

  worker.drawHideToggles = function(){
    $(".toggleVisibility").remove();
    var main = $(document.createElement('div')).addClass("toggleVisibility");
      for(var name in worker.state){
        if(worker.state.hasOwnProperty(name)){
          var toggleID = "hide" + name;
          latestToggle = $(document.createElement('div')).append("Hide " + name + "<input type='checkbox' id=" + toggleID +">");
          main.append(latestToggle);
        }
      }
      $("#hideTools").append(main);
      for(var name in worker.state){
        if(worker.state.hasOwnProperty(name)){
          var toggleID = "hide" + name;
          toggleChangeHandler(toggleID, name);
        }
      }
    };

  worker.updateVisible = function(canvasObject, isVisible){
    canvasObject.visible = isVisible;
    //canvasObject.outputObject.visible = isVisible;
    worker.canvas.renderAll();
  }

  worker.drawSelection = function(){
    /*****************************
    Need to SAVE THIS DATA FIRST!!! We will assume this is done BEFORE this function is called. Thus the current selection is our new value.
    ******************************/
    $(".selectPopulateCanvas").remove();
    var canvasObject = worker.canvas.getActiveObject();
    var category;
    var fieldList = [];
    var moveZUpID = "inari_Zup";
    var moveZDownID = "inari_Zdown";
    if(canvasObject){
      category = canvasObject.categoryType;
    }
    //Check to see if this category is a list of objects
    if(worker.state.hasOwnProperty(category) && Object.prototype.toString.call( worker.state[category] ) === "[object Array]" && worker.state[category].length > 0){
      //it is!
        var main = $(document.createElement('div')).addClass("selectPopulateCanvas");
        var outputObject = canvasObject.outputObject;
        for(var key in outputObject){
          if(outputObject.hasOwnProperty(key)){
            if(typeof(outputObject[key]) != "object"){
              var newID = "inari_" + key;
              latestField = $(document.createElement('div')).addClass("editfield").append(key + ": <input type = 'text' class='outputField' id=" + newID + ">");
              fieldList.push([newID, outputObject[key], [key]]);
              //selectionUpdateHandlers("#"+newID, canvasObject, key);
              main.append(latestField);
            }
            else{
              latestField = $(document.createElement('div')).addClass("editfield").append(key + ": ");
              for (var subkey in outputObject[key]){
                if (outputObject[key].hasOwnProperty(subkey)){
                  var newID = "inari_" + key + "_" + subkey;
                  latestField.append("<div>" + subkey + ": <input type = 'text' class = 'outputField' id=" + newID + "></div>");
                  fieldList.push([newID, outputObject[key][subkey], [key, subkey]]);
                  //selectionUpdateHandlers("#"+newID, canvasObject, key, subkey);
                }
              }
              main.append(latestField);
            }
          }
        }
        if(worker.getZLevelFromCategory(category) != 0){
            //This means we should allow the user to adjust depth on this object.
            latestField = $(document.createElement('div')).addClass("editfield").append("<button class='Zbutton' id=" + moveZUpID +">Move up in Z level</button>")
                                                                                .append("<button class='Zbutton' id=" + moveZDownID +">Move down in Z level</button>");
            main.append(latestField);
          }
        $(".selectPopulate").append(main);
      }
    else if(worker.state.hasOwnProperty(category) && Object.prototype.toString.call( worker.state[category] ) === "[object Object]" && worker.state[category]){
      //it's a stand alone object
      var main = $(document.createElement('div')).addClass("selectPopulateCanvas");
      var outputObject = canvasObject.outputObject;
      for(var key in outputObject){
          if(outputObject.hasOwnProperty(key)){
            if(typeof(outputObject[key]) != "object"){
              var newID = "inari_" + key;
              latestField = $(document.createElement('div')).addClass("editfield").append(key + ": <input type = 'text' class='outputField' id=" + newID + ">");
              //selectionUpdateHandlers("#"+newID, canvasObject, key);
              fieldList.push([newID, outputObject[key], [key]]);
              main.append(latestField);
            }
            else{
              latestField = $(document.createElement('div')).addClass("editfield").append(key + ": ");;
              for (var subkey in outputObject[key]){
                if (outputObject[key].hasOwnProperty(subkey)){
                  var newID = "inari_" + key + "_" + subkey;
                  latestField.append("<div>" + subkey + ": <input type = 'text' 'outputField' id=" + newID + "></div>");
                  fieldList.push([newID, outputObject[key][subkey], [key, subkey]]);
                }
              }
              main.append(latestField);
            }
          }
        }
        if(worker.getZLevelFromCategory(category) != 0){
            //This means we should allow the user to adjust depth on this object.
            latestField = $(document.createElement('div')).addClass("editfield").append("<button class='Zbutton' id=" + moveZUpID +">Move up in Z level</button>")
                                                                                .append("<button class='Zbutton' id=" + moveZDownID +">Move down in Z level</button>");
            main.append(latestField);
          }
        $(".selectPopulate").append(main);
      }
      //Add the button handlers if necessary
      $("#"+ moveZUpID).click(function(){
        worker.moveUpZLevel(canvasObject);
      });
      $("#"+ moveZDownID).click(function(){
        worker.moveDownZLevel(canvasObject);
      });

      //Add other handlers
      for (var i=0; i<fieldList.length; i++){
        $("#"+fieldList[i][0]).val(fieldList[i][1]);
        if(fieldList[i][2].length>1){
        selectionUpdateHandlers("#"+fieldList[i][0], canvasObject, fieldList[i][2][0], fieldList[i][2][1]);
        }
        else{
          selectionUpdateHandlers("#"+fieldList[i][0], canvasObject, fieldList[i][2][0]);
        }
      }
  }

  worker.getCanvasObjectByCategoryAndID = function(category, dropDownID){
    if(worker.state.hasOwnProperty(category)){
      if(Object.prototype.toString.call( worker.state[category] ) === "[object Array]"){
        for(var i = 0; i < worker.state[category].length; i++){
          if(worker.state[category][i].dropDownID == dropDownID){
            return worker.state[category][i];
          }
        }
      }
      else{
        if(worker.state[category] && worker.state[category].dropDownID == dropDownID){
          return worker.state[category];
        }
      }
    }
    return null;
  }

  worker.countFields = function(state){
    count = 0;
    for(var category in state) {
      if(state.hasOwnProperty(category)){
        if(category==="World"){
        }
        else if(state.hasOwnProperty(category) && Object.prototype.toString.call( state[category] ) === "[object Array]" && state[category].length > 0){
          for(var i =0; i < state[category].length; i++){
            if(state[category][i] != null){
              count+=1;
            }
          }
        }
        else if(state.hasOwnProperty(category) && Object.prototype.toString.call( state[category] ) === "[object Object]" && state[category]){
          if(state[category]!=null){
            count+=1;
          }
        }
      }
    }
    return count;
  }

  worker.populate = function(newState) {
    worker.desiredState = {};
    var desiredState = worker.desiredState;
    var total = worker.countFields(newState);
    for(var category in newState) {
      if(newState.hasOwnProperty(category)){
        if(category==="World"){
          worker.updateWorldWidth(newState.World.Width);
          worker.updateWorldHeight(newState.World.Height, true);
        }
        else if(newState.hasOwnProperty(category) && Object.prototype.toString.call( newState[category] ) === "[object Array]" && newState[category].length > 0){
          if(!desiredState.hasOwnProperty(category)){
            desiredState[category] = [];
          }
          for(var i =0; i < newState[category].length; i++){
            worker.populateImage(newState[category][i], category, i, desiredState);
          }
        }
        else if(newState.hasOwnProperty(category) && Object.prototype.toString.call( newState[category] ) === "[object Object]" && newState[category]){
          if(!desiredState.hasOwnProperty(category)){
            desiredState[category] = {};
          }
          worker.populateImage(newState[category], category, -1, desiredState);
        }
      }
    }/*
    var total = worker.countFields(newState);
    //Wait for async to finish
    while(worker.countFields(desiredState) != total){
      console.log("--");
      console.log(total);
      console.log(worker.countFields(desiredState));
    }
    for(var category in desiredState) {
      if(desiredState.hasOwnProperty(category)){
        if(category==="World"){
        }
        else if(desiredState.hasOwnProperty(category) && Object.prototype.toString.call( desiredState[category] ) === "[object Array]" && desiredState[category].length > 0){
          for(var i =0; i < desiredState[category].length; i++){
            oImg = desiredState[category][i];
            worker.canvas.add(oImg);
            worker.addObject(oImg);
            worker.updateDropDownID(oImg.imgSource);
            $("#categorySelect").change(); 
          }
        }
        else if(desiredState.hasOwnProperty(category) && Object.prototype.toString.call( desiredState[category] ) === "[object Object]" && desiredState[category]){
          oImg = desiredState[category];
            worker.canvas.add(oImg);
            worker.addObject(oImg);
            worker.updateDropDownID(oImg.imgSource);
            $("#categorySelect").change(); 
        }
      }
    }
    */
    console.log("function finished");
    worker.verifyPopulated(total);
    //worker.canvas.add(oImg);
    //worker.addObject(oImg);
    //worker.updateDropDownID(oImg.imgSource);
    //$("#categorySelect").change(); 
    //worker.canvas.renderAll();
  }
  worker.drawInOrder = function(desiredState){
    for(var category in desiredState) {
      if(desiredState.hasOwnProperty(category)){
        if(category==="World"){
        }
        else if(desiredState.hasOwnProperty(category) && Object.prototype.toString.call( desiredState[category] ) === "[object Array]" && desiredState[category].length > 0){
          for(var i =0; i < desiredState[category].length; i++){
            oImg = desiredState[category][i];
            worker.canvas.add(oImg);
            worker.addObject(oImg);
            worker.updateDropDownID(oImg.imgSource);
            $("#categorySelect").change();
          }
        }
        else if(desiredState.hasOwnProperty(category) && Object.prototype.toString.call( desiredState[category] ) === "[object Object]" && desiredState[category]){
          oImg = desiredState[category];
            worker.canvas.add(oImg);
            worker.addObject(oImg);
            worker.updateDropDownID(oImg.imgSource);
            $("#categorySelect").change(); 
        }
      }
    }
    worker.canvas.renderAll();
  }

  worker.verifyPopulated = function(targetSize){
    if(worker.countFields(worker.desiredState) == targetSize){
      console.log("Async call finished. Drawing Canvas...");
      worker.drawInOrder(worker.desiredState);
    }
    else{
      setTimeout(function(){worker.verifyPopulated(targetSize);}, 1000);
    }
  }


worker.asyncLoop = function (iterations, func, callback) {
    var index = 0;
    var done = false;
    var loop = {
        next: function() {
            if (done) {
                return;
            }

            if (index < iterations) {
                index++;
                func(loop);

            } else {
                done = true;
                callback();
            }
        },

        iteration: function() {
            return index - 1;
        },

        break: function() {
            done = true;
            callback();
        }
    };
    loop.next();
    return loop;
}

  worker.populateImage  = function(outputObject, category, drawOrder, desiredState){
    fabric.Image.fromURL(outputObject.PNGSource, function(oImg){
              console.log("loaded");
              oImg.dropDownID = worker.generateDropDownID(outputObject.PNGSource);
              oImg.imgSource = outputObject.PNGSource;
              oImg.categoryType = category;
              oImg.lockScalingX = true; //make it so we cannot resize the images
              oImg.lockScalingY = true;
              //oImg.width = outputObject.Width;
              //oImg.height = outputObject.Height;
              outputObject.Width = oImg.width;
              outputObject.Height = oImg.height;
              var defaultObj = worker.generateDefaultObject(oImg);
              for (var property in defaultObj) {
                if (defaultObj.hasOwnProperty(property) && !outputObject.hasOwnProperty(property)) {
                    outputObject[property] = defaultObj[property];
                }
              }
              //This is for legacy purposes
              if(outputObject.hasOwnProperty('visible')){
                oImg.visible = outputObject.visible;
              }
              if(outputObject.hasOwnProperty("flipVertical")){
                oImg.set("flipY", outputObject.flipVertical);
              }
              if(outputObject.hasOwnProperty("flipHorizontal")){
                oImg.set("flipX", outputObject.flipHorizontal);
              }
              oImg.outputObject = outputObject;
              //worker.setLocation(oImg);
              if(oImg.outputObject.hasOwnProperty("PlistSource")){
                if(oImg.outputObject.PlistSource === "not implemented"){
                  oImg.outputObject.PlistSource = worker.imgToPlist(oImg.imgSource);
                }
                worker.updatePList(oImg.outputObject.PlistSource, oImg);
              }

              worker.updateLocation(oImg);
              
              if(drawOrder >=0){
                desiredState[category][drawOrder] = oImg;
              }
              else{
                desiredState[category] = oImg;
              }
    });
  }

  worker.toggleHorizontalFlip = function(isFlipped, canvasObject){
    canvasObject.set("flipX", isFlipped);
    worker.canvas.renderAll();
  }

  worker.toggleVerticalFlip = function(isFlipped, canvasObject){
    canvasObject.set("flipY", isFlipped);
    worker.canvas.renderAll();
  }

  worker.handleDownload = function(){
    output = {};
    output.World = {
      "Width": worker.worldWidth,
      "Height": worker.worldHeight
    };
    filename = $("#levelName").val();
    for(var key in worker.state){
      if(worker.state.hasOwnProperty(key)){
        if(Object.prototype.toString.call( worker.state[key] ) === "[object Array]"){
          output[key] = worker.state[key].map(function(canvasObject){return canvasObject.outputObject;});
        }
        else if(worker.state[key] && worker.state[key].outputObject){
          output[key] = worker.state[key].outputObject;
        }
      }
    }
    download(filename, JSON.stringify(output));
  }

  worker.handleFileSelect = function(){
      if (window.File && window.FileReader && window.FileList && window.Blob) {

      } else {
          alert('The File APIs are not fully supported in this browser.');
          return;
      }   

      input = document.getElementById('fileinput');
     if (!input.files) {
        alert("This browser doesn't seem to support the `files` property of file inputs.");
     }
     else if (!input.files[0]) {
        alert("Please select a file before clicking 'Load'");               
     }
     else {
        file = input.files[0];
        fr = new FileReader();
        fr.onload = worker.receivedFile;
        fr.readAsText(file);
     }
  }


  worker.receivedFile = function() {           
     worker.refresh();
     var newState = JSON.parse(fr.result);
     worker.populate(newState);
  } 

  worker.snapToGrid = function (parameter){
    return Math.round(parameter / worker.grid) * worker.grid;
  }

  worker.deselect = function(){
    worker.hoverImage = null;
    $(".selected").removeClass("selected");
  }

  worker.initializeTypeGenerators = function(){
    worker.objectTypeGenerators = {
                    "ForegroundLayers": worker.createForegroundLayer,
                    "BackgroundLayers":  worker.createBackgroundLayer,
                    "BackgroundAestheticDetails":  worker.createBackgroundAestheticDetail,
                    "ForegroundAestheticDetails":  worker.createForegroundAestheticDetail,
                    "AnimatedDetails" : worker.createAnimatedDetail,
                    "EnvironmentTiles":  worker.createTile,
                    "Avatar":  worker.createAvatar,
                    "Nodes":  worker.createNode,
                    "Spawners":  worker.createSpawner,
                    "Enemies":  worker.createEnemy,
                    "Goal":  worker.createGoal,
                    "Hazards": worker.createHazard,
                    "Portals": worker.createPortal,
                    "CheckPoints": worker.createCheckPoint,
                    "Receptacles" : worker.createReceptacle
                 };
  }

  worker.updatePList = function(plistFile, canvasObject){
    $.getJSON(plistFile, {}, function(data){
      if(data.hasOwnProperty("shape")){
        canvasObject.outputObject.PList = data.shape;
      }
    });
  }

  worker.initializeDownloader = function(){
    $("#btnLoad").click(worker.handleFileSelect);
    $("#btnSave").click(worker.handleDownload);
    //Make sure we don't delete anything by accident
    $("#levelName").focus(function(){
      $("#categorySelect").change();
    });
  }
  worker.init = function(){
    worker.refresh();
    worker.initializeTypeGenerators();
    worker.initializeCanvasHandlers();
    worker.initializeWorldControls();
    worker.initializeDownloader();
  }

  worker.init();
  return worker;
};


//------------------------------------------------------End Worker-------------------------------------------
var worker = {};
var canvas;
$(document).ready(function(){
  worker = createWorker();

  $.getJSON("drawTypes.json", {}, function(data){
    //Preload Images
    for (var key in data) {
      if (data.hasOwnProperty(key)) {
        if(data[key].hasSubCategory){
          for(var i = 0; i<data[key].img.length; i++){
            for(var subI = 0; subI<data[key].img[i].imgList.length; subI++){
              $("<img />").attr("src", data[key].img[i].imgList[subI]);
            }
          }
        }
        else{
          for(var i = 0; i<data[key].img.length; i++){
            $("<img />").attr("src", data[key].img[i]);
          }
        }
      }
    }
    //----
    worker.drawData = data;
    worker.removeAllOptions("#categorySelect");
    worker.removeAllOptions("#categoryTool");
    worker.removeAllOptions("#subcategorySelect");
    worker.removeAllOptions("#subcategoryTool");

    worker.addChangeHandler("#categoryTool", categoryToolUpdate);
    worker.addChangeHandler("#subcategoryTool", subcategoryToolUpdate);
    worker.addChangeHandler("#categorySelect", categorySelectUpdate);
    worker.addChangeHandler("#subcategorySelect", subcategorySelectUpdate);
    for (var key in data) {
      if (data.hasOwnProperty(key)) {
        worker.addToDropDown("#categorySelect", key);
        worker.addToDropDown("#categoryTool", key);
      }
    }
    categoryToolUpdate();
    categorySelectUpdate();
  });
});




function categoryToolUpdate(){
  worker.removeAllOptions("#subcategoryTool");
  worker.hoverImage = null;
  selection = $("#categoryTool").val();
  worker.toolDropMap = {};
  if(worker.drawData[selection].hasSubCategory){
    for(var i = 0; i < worker.drawData[selection].img.length; i++){
      if(i ==0){
        worker.tools = worker.drawData[selection].img[0].imgList;
      }
      worker.addToDropDown("#subcategoryTool", worker.drawData[selection].img[i].name);
      worker.toolDropMap[worker.drawData[selection].img[i].name] = i;
    }
  }
  else{
    worker.tools = worker.drawData[selection].img;
    worker.addToDropDown("#subcategoryTool", "No subcategories");
  }
  worker.drawTools();
}

function subcategoryToolUpdate(){
  category = $("#categoryTool").val();
  subcategory = $("#subcategoryTool").val();
  if(worker.drawData[category].hasSubCategory){
    subcategoryIndex = worker.toolDropMap[subcategory];
    worker.tools = worker.drawData[category].img[subcategoryIndex].imgList;
    worker.drawTools();
  }
}

function categorySelectUpdate(){
  categorySelectRedraw();
  $("#subcategorySelect").change();
}

function categorySelectRedraw(){
  worker.removeAllOptions("#subcategorySelect");
  var selection = $("#categorySelect").val();
  worker.selectDropMap = {};
  worker.addToDropDown("#subcategorySelect", worker.defaultSelectPrompt);
  if(Object.prototype.toString.call( worker.state[selection] ) === "[object Array]"){
    for(var i = 0; i < worker.state[selection].length; i++){
      worker.addToDropDown("#subcategorySelect", worker.state[selection][i].dropDownID);
    }
  }
  else{
    if(worker.state[selection]){
      worker.addToDropDown("#subcategorySelect", worker.state[selection].dropDownID);
    }
  }
}

function subcategorySelectUpdate(){
  category = $("#categorySelect").val();
  subcategory = $("#subcategorySelect").val();
  canvasObject = worker.getCanvasObjectByCategoryAndID(category, subcategory);
  if(canvasObject){
    worker.canvas.setActiveObject(canvasObject);
  }
  else{
    worker.canvas.deactivateAll().renderAll();
  }
  worker.drawSelection();
}

function toggle(self){
  if($(self).hasClass("selected")){
    //Deselect
    worker.deselect();
  }
  else{
    //Adjust view
    worker.deselect();
    $(self).addClass("selected");
    worker.hoverImage = {
      'src': $(self).find('img').attr('src'),
      'canvasElement': null,
      'type' : $("#categoryTool").val()
    };
  }
}

function tileClickHandler(tile){
  $(tile).mousedown(function(){
    toggle(this);
  });
}

function toggleChangeHandler(toggleID, stateName){
  $("#" + toggleID).change(function(){
      if(worker.state.hasOwnProperty(stateName)){
        var elems = worker.state[stateName];
        var isChecked = $(this).is(":checked");
        if(Object.prototype.toString.call( elems ) === "[object Array]"){
          for(var i=0; i< elems.length; i++){
            worker.updateVisible(elems[i], !isChecked);
          }
        }
        else{
          worker.updateVisible(elems, !isChecked);
        }
      }
    });
}

function selectionUpdateHandlers(selection,canvasObject, key, subkey){
  $(selection).blur(function(){
    if(subkey){
      var typedReturn = typeFunctions(canvasObject.outputObject[key][subkey], $(selection).val());
      $(selection).val(typedReturn);
      canvasObject.outputObject[key][subkey] = typedReturn;
      if(key==="Location"){
        worker.updateLocation(canvasObject);
      }
    }
    else{
      var typedReturn = typeFunctions(canvasObject.outputObject[key], $(selection).val());
      $(selection).val(typedReturn);
      canvasObject.outputObject[key] = typedReturn;
      if(key==="PlistSource"){
        worker.updatePList(typedReturn, canvasObject);
      }
      if(key==="flipVertical"){
        worker.toggleVerticalFlip(typedReturn, canvasObject);
      }
      if(key==="flipHorizontal"){
        worker.toggleHorizontalFlip(typedReturn, canvasObject);
      }
    }
  });
  $(selection).keyup(function(event){
    if(event.keyCode == 13){
      if(subkey){
        var typedReturn = typeFunctions(canvasObject.outputObject[key][subkey], $(selection).val());
        $(selection).val(typedReturn);
        canvasObject.outputObject[key][subkey] = typedReturn;
        if(key==="Location"){
          worker.updateLocation(canvasObject);
        }
      }
      else{
        var typedReturn = typeFunctions(canvasObject.outputObject[key], $(selection).val());
        $(selection).val(typedReturn);
        canvasObject.outputObject[key] = typedReturn;
        if(key==="PlistSource"){
          worker.updatePList(typedReturn, canvasObject);
        }
        if(key==="flipVertical"){
        worker.toggleVerticalFlip(typedReturn, canvasObject);
        }
        if(key==="flipHorizontal"){
          worker.toggleHorizontalFlip(typedReturn, canvasObject);
        }
      }
    }
  });
}

function typeFunctions(target, input){
  type = typeof(target);
  if (type ==="boolean"){
    return input.toUpperCase() === "TRUE";
  }
  else if (type ==="number"){
    return Number(input);
  }
  else{
    return String(input);
  }
}

function removeHandler(tile){
  $(tile).off();
}


function download(filename, text) {
  var element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

