var createCSEditor = function(){
	var worker = {};
	worker.refresh = function(){
		//used for unique action ID creation
		worker.actionsCreated = 0;
		worker.items.clear();
		worker.groups.clear();
		worker.defaultActionDuration = 3000;
		worker.CutSceneTypeEnum = {
			StartCutSceneAction: 0,
			CameraAction: 1,
			AvatarAction: 2,
		};

		worker.CutSceneSubTypes = {
			StartCutSceneAction: {},
			CameraAction: {
				MoveCamera: 0
			},
			AvatarAction: {}
		};

		//A mapping from raw field name to its display name in the editor. The display name should be specific enough such that a user knows exactly what your field does
		worker.fieldNameMapping = {
			content: "Action Name",
			WaitForAnimation: "Wait for parent animation",
			WaitForPhysical: "Wait for parent physical",
			Delay: "Delay (in seconds)",
			RequireX: "Must reach X coordinate",
			RequireY: "Must reach Y coordinate",
			TravelTime: "Travel Time (in seconds)",
			TargetLocation: "Target Location",
			Duration: "Length of action (in seconds)"
		}

		//A mapping used when saving values. If a field is listed below, the saved value for that field will be the result of the mapped function call on our target object.
		//That is, each function must be of the form function(actionObject) -> field value
		worker.saveFieldMapping = {
			start: worker.getItemStartTime,
			end: worker.getItemEndTime,
			childActions: worker.handleChildrenCutSceneGraph,
		}
		//A mapping used when loading values. If a field is listed below, the saved value for that field will be the result of the mapped function call on our target object.
		//That is, each function must be of the form function(actionObject) -> field value 
		worker.loadFieldMapping = {
			childActions: worker.handleLoadChildren,
			group: worker.handleLoadGroup,
		}

		worker.CutSceneMapNumberToType = worker.getReverseEnum(worker.CutSceneTypeEnum);
		worker.CutSceneMapNumberToSubType = worker.getLayeredReverseEnum(worker.CutSceneMapNumberToType, worker.CutSceneSubTypes);
		worker.cutSceneID = null;
		worker.rootAction = null;
		worker.currentActionId = null;
		worker.currentGroup = null;
		worker.currentAction = null;
		worker.actionFields = {};
		worker.defaultActionType = worker.CutSceneTypeEnum.CameraAction;
		worker.defaultSubType = worker.CutSceneSubTypes.CameraAction.MoveCamera;
		worker.actionTypeSelectRedraw();
	}
	worker.toggleCreateAction = function(disabled){
		$("#newAction").prop("disabled", disabled);
	};
	worker.toggleCreateGroup = function(disabled) {
		$("#newGroup").prop("disabled", disabled);
		$("#newGroupValue").prop("disabled", disabled);
	}
	worker.toggleTimeLineControls = function(disabled){
		worker.toggleCreateAction(disabled);
		worker.toggleCreateGroup(disabled);
	}

	worker.generateDefaultObject = function(actionTypeEnum, actionSubtypeEnum){
	    var output = {}
	    var actionString = worker.CutSceneMapNumberToSubType[actionTypeEnum][actionSubtypeEnum];
	    if(worker.objectTypeGenerators.hasOwnProperty(actionString)){
	        output = worker.objectTypeGenerators[actionString]();
	    }
	    return Object.assign(worker.actionRequiredFields(), output);
	}

	//A mapping from specific action sub types to a function that generates an object with the default fields required for the specified sub type
	worker.initializeTypeGenerators = function(){
    	worker.objectTypeGenerators = {
                    "MoveCamera": worker.createMoveCamera,
        };
  	}

  	worker.initializeSpecialSelectionHandlers = function() {
  		worker.specialSelectionHandlers = {
  			"Delay": worker.updateDelay,
  			"Duration": worker.updateDuration,
  		};
  	}

  	worker.updateDelay = function(actionObject){
  		var newDelay = actionObject.Delay * 1000;
  		var parentObject = worker.getItem(actionObject.parentAction);
  		actionObject.start = worker.getItemEndTime(parentObject) + (newDelay);
  		actionObject.end = actionObject.start + (actionObject.Duration * 1000);
  	}

  	worker.updateDuration = function(actionObject){
  		var newDuration = actionObject.Duration * 1000;
  		actionObject.end = actionObject.start + newDuration;
  	}

  	//The fields required, regardless of action type
  	worker.actionRequiredFields = function(){
  		return {
  			WaitForAnimation: true,
  			WaitForPhysical: true,
  			Delay: 0,
  			Duration: 3,
  			content: "ActionName",
  		};
  	};

  	worker.createMoveCamera = function(){
  		return {
  			TargetLocation: {X: 0, Y: 0},
  			TravelTime: 1,
  			RequireX: true,
  			RequireY: true,
  		};
  	};

	worker.getReverseEnum = function(enumMap){
		var output = {};
		for (var key in enumMap){
			output[enumMap[key]] = key;
		}
		return output;
	}

	worker.getLayeredReverseEnum = function(enumKeys, mapToReverse){
		var output = {}
		for(var key in enumKeys){
			output[key] = worker.getReverseEnum(mapToReverse[enumKeys[key]]);
		}
		return output;
	}

	worker.getUniqueActionId = function(){
		var actionId = "Action" + worker.actionsCreated;
		worker.actionsCreated++;
		while(worker.getItem(actionId)){
			actionId = "Action" + worker.actionsCreated;
			worker.actionsCreated++;
		}
		return actionId;
	}
	worker.getItem = function(itemId){
		return itemId === worker.cutSceneID ? worker.rootAction : worker.items.get(itemId);
	}
	worker.addActionItem = function(parentId, group, start, duration){
		var actionId = worker.getUniqueActionId();
		parent = worker.getItem(parentId);
		worker.items.add({
			id: actionId,
			group: group,
			content: actionId,
			start: start,
			end: start + duration,
			parentAction: parentId,
			childActions: [],
			ActionType: worker.defaultActionType,
			ActionSubtype: worker.defaultSubType,
		});
		if(parent){
			parent.childActions.push(actionId);
			if(parentId !== worker.cutSceneID){
				worker.items.update(parent);
			}
		}
	};

	worker.removeActionItem = function(removedAction){
		var parentObject = worker.getItem(removedAction.parentAction);
		if(removedAction && removedAction.parentAction && removedAction.childActions && removedAction.id && parentObject){
			newChildren = [];
			parentObject.childActions = parentObject.childActions.filter((childId) =>childId !== removedAction.id);
			//Don't fire an update if we're touching the root node
			actionsToUpdate = removedAction.parentAction === worker.cutSceneID ? [] : [parentObject];
			removedAction.childActions.forEach((childId) => {
				childObject = worker.items.get(childId);
				if(childObject){
					childObject.parentAction = removedAction.parentAction;
					parentObject.childActions.push(childId);
					actionsToUpdate.push(childObject);
				}
			});
			worker.items.update(actionsToUpdate);
		}
	}

	worker.setCurrentAction = function(actionId){
		worker.currentActionId = actionId;
		worker.currentAction = actionId ? worker.getItem(actionId) : null;
		worker.currentGroup = worker.currentAction ? worker.currentAction.group : worker.currentGroup;
		worker.actionTypeSelectRedraw();
	}

	worker.getItemStartTime = function(actionObject){
		return typeof(actionObject.start) === "object" ? actionObject.start.getTime() : actionObject.start;
	}

	worker.getItemEndTime = function(actionObject){
		return typeof(actionObject.end) === "object" ? actionObject.end.getTime() : actionObject.end;
	}

	worker.addHandlers = function(){
		//Handle action removal
		worker.items.on("remove", function(e, removedObjectWrapper){
			removedObjectWrapper.oldData.forEach( function(oldData){
				worker.removeActionItem(oldData);
			});
			worker.currentAction = null;
			worker.currentActionId = null;
			worker.drawSelection();
		});

		worker.items.on("update", function(e, updatedObjectWrapper){
			updatedObjectWrapper.data.forEach( function(newData, ind) {
				//Handle movement
				//Assume that the start and end fields are correct. Update Duration and Delay
				if(newData.start != updatedObjectWrapper.oldData[ind].start || newData.end != updatedObjectWrapper.oldData[ind].end){
					var parentAction = worker.getItem(newData.parentAction);
					newData.Duration = (newData.end - newData.start) / 1000;
					newData.Delay = (newData.start - parentAction.end) / 1000;
					$("#inari_Delay").val(newData.Delay);
					$("#inari_Duration").val(newData.Duration);
					var itemsToUpdate = [newData]
					newData.childActions.forEach((childId) => {
						var childAction = worker.getItem(childId);
						//update the new delay field
						childAction.Delay = (childAction.start - newData.end) / 1000;
						itemsToUpdate.push(childAction);
					})
					worker.items.update(itemsToUpdate);

				}
				

			})
		})

		$("#newAction").click(function(event){
			var parentObject = worker.currentActionId ? worker.items.get(worker.currentActionId) : worker.rootAction;
			var start = worker.getItemEndTime(parentObject);
			worker.addActionItem(parentObject.id, worker.currentGroup, start, worker.defaultActionDuration);
		});

		$("#newGroup").click(function(event){
			var groupName = $("#newGroupValue").val();
			if(!worker.groups.get(groupName)){
				worker.groups.add({content: groupName, id: groupName});
				worker.currentGroup = groupName;
				worker.toggleCreateAction(false);
			}
			else{
				alert("Group with name: '" + groupName + "' already exists. Please choose another name.");
			}
		});

		worker.timeline.on("select", function(result){
			if(result && result.items && result.items.length > 0){
				worker.setCurrentAction(result.items[0]);
			}
			else{
				//Set our root as the current action
				worker.setCurrentAction(null);
			}
		});

		worker.addChangeHandler("#actionTypeSelect", function(){
			var selection = $("#actionTypeSelect").val();
			if(worker.currentAction && (worker.currentAction.ActionType !== worker.CutSceneTypeEnum[selection])){
				worker.currentAction.ActionType = worker.CutSceneTypeEnum[selection];
				worker.items.update(worker.currentAction);
			}
			worker.subactionTypeSelectRedraw();
		});

		worker.addChangeHandler("#subactionTypeSelect", function(){
			var parentSelection = $("#actionTypeSelect").val();
			var selection = $("#subactionTypeSelect").val();
			if(worker.currentAction){
				worker.currentAction.ActionSubtype = worker.CutSceneSubTypes[parentSelection][selection];
				worker.actionFields = worker.generateDefaultObject(worker.CutSceneTypeEnum[parentSelection], worker.CutSceneSubTypes[parentSelection][selection]);
				var actionFieldsCopy = Object.assign({}, worker.actionFields);
				worker.currentAction = Object.assign(actionFieldsCopy, worker.currentAction);
				worker.items.update(worker.currentAction);
			}
			worker.drawSelection();
		});

		worker.addChangeHandler("#cutSceneSelect", function(){
			var selection = $("#cutSceneSelect").val();
			if(worker.outputState[selection]){
				worker.saveCurrentCutScene(selection);
				worker.loadCutSceneById(selection);
			}
		});

		$("#btnNewCutSceneName").click(function(event){
			var newRootId = $("#newCutSceneName").val();
			//Save our current cutscene
			worker.saveCurrentCutScene();
			//Create a new one
			worker.createNewCutScene(newRootId);
			worker.drawCutSceneNameField(newRootId);
			worker.toggleTimeLineControls(false);
		});

	}


	//Populates the edit fields if an element of the timeline is selected
	worker.drawSelection = function(){
	  //Immediately clear the canvas
	  $(".selectPopulateTimeline").remove();
	  var fieldList = [];
	  if (worker.currentAction && worker.actionFields){
	      //An object is selected
	      var main = $(document.createElement('div')).addClass("selectPopulateTimeline");
	      var outputObject = worker.currentAction;
	      for(var key in worker.actionFields){
	          if(outputObject.hasOwnProperty(key)){
	            if(typeof(outputObject[key]) != "object"){
	              var newID = "inari_" + key;
	              var displayName = worker.fieldNameMapping[key] || key;
	              latestField = $(document.createElement('div')).addClass("editfield small").append("<div class='outputFieldName'>" + displayName + ":" + "</div>" + "<input type = 'text' class='outputField' id=" + newID + ">");
	              fieldList.push([newID, outputObject[key], [key]]);
	              main.append(latestField);
	            }
	            else{
	            var displayName = worker.fieldNameMapping[key] || key;
	              latestField = $(document.createElement('div')).addClass("editfield large").append("<div class='outputFieldNameBlock'>" + displayName + ":" + "</div>");;
	              for (var subkey in outputObject[key]){
	                if (outputObject[key].hasOwnProperty(subkey)){
	                	displayName = worker.fieldNameMapping[subkey] || subkey;
	                  var newID = "inari_" + key + "_" + subkey;
	                  latestField.append("<div class = 'editfield small'><div class='outputFieldName'>" + displayName + ":" + "</div>" + "<input type = 'text' class = 'outputField' id=" + newID + "></div>");
	                  fieldList.push([newID, outputObject[key][subkey], [key, subkey]]);
	                }
	              }
	              main.append(latestField);
	            }
	          }
	        }
	        $(".selectPopulate").append(main);
	      }

	      //Add other handlers
	      for (var i=0; i<fieldList.length; i++){
	        $("#"+fieldList[i][0]).val(fieldList[i][1]);
	        if(fieldList[i][2].length>1){
	          worker.selectionUpdateHandlers("#"+fieldList[i][0], worker.currentAction, fieldList[i][2][0], fieldList[i][2][1]);
	        }
	        else{
	          worker.selectionUpdateHandlers("#"+fieldList[i][0], worker.currentAction, fieldList[i][2][0]);
	        }
	      }
	}

	worker.drawCutSceneNameField = function(cutSceneId){
		$(".cutSceneNameHook").remove();
		var main = $(document.createElement('div')).addClass("cutSceneNameHook");
		var nameControl = main.append("<h3>Cutscene Name: <input type='text' id ='cutSceneNameControl' class = 'outputField'></h3>");
		$("#cutSceneName").append(main);
		$("#cutSceneNameControl").val(cutSceneId);
		worker.rootNodeIdUpdateHandlers("#cutSceneNameControl");
	}

	worker.actionTypeSelectRedraw = function(){
		worker.removeAllOptions("#actionTypeSelect");
		for(var actionType in worker.CutSceneTypeEnum){
			worker.addToDropDown("#actionTypeSelect", actionType);
		}
		if(worker.currentAction){
			$("#actionTypeSelect").val(worker.CutSceneMapNumberToType[worker.currentAction.ActionType]);
		}
		$("#actionTypeSelect").change();
	}

	worker.cutSceneSelectRedraw = function(){
		worker.removeAllOptions("#cutSceneSelect");
		for(var cutSceneName in worker.outputState){
			worker.addToDropDown("#cutSceneSelect", cutSceneName);
		}
	}

	worker.subactionTypeSelectRedraw = function(){
		worker.removeAllOptions("#subactionTypeSelect");
		if(worker.currentAction){
			var parentSelection = worker.CutSceneMapNumberToType[worker.currentAction.ActionType];
			for(var subactionType in worker.CutSceneSubTypes[parentSelection]){
				worker.addToDropDown("#subactionTypeSelect", subactionType);
			}
			if(worker.CutSceneMapNumberToSubType[worker.currentAction.ActionType] && worker.CutSceneMapNumberToSubType[worker.currentAction.ActionType][worker.currentAction.ActionSubtype]){
				$("#subactionTypeSelect").val(worker.CutSceneMapNumberToSubType[worker.currentAction.ActionType][worker.currentAction.ActionSubtype]);
			}
		}
		$("#subactionTypeSelect").change();
	}

	worker.init = function(){
		worker.outputState = {}; //The output state for saving JSONs
		worker.initializeTypeGenerators();
		worker.initializeSpecialSelectionHandlers();
		worker.groups = new vis.DataSet();
		worker.items = new vis.DataSet();
		worker.container = document.getElementById('visualization');
		worker.options = {
		    // option groupOrder can be a property name or a sort function
		    // the sort function must compare two groups and return a value
		    //     > 0 when a > b
		    //     < 0 when a < b
		    //       0 when a == b
		    groupOrder: function (a, b) {
		      return a.value - b.value;
		    },
		    groupOrderSwap: function (a, b, groups) {
		    	var v = a.value;
		    	a.value = b.value;
		    	b.value = v;
		    },
		    minHeight: 150,
		    maxHeight: 500,
		    orientation: 'both',
		    editable: true,
		    groupEditable: true,
		    showMajorLabels: false,
		    min: 0,
		    max: 80000,
		    start: 0,
		    end: 80000
		};

		worker.timeline = new vis.Timeline(worker.container);
		worker.timeline.setOptions(worker.options);
		worker.timeline.setGroups(worker.groups);
		worker.timeline.setItems(worker.items);		
		worker.addHandlers();
		worker.initializeDownloader();
		worker.refresh();
		worker.cutSceneSelectRedraw();
		worker.toggleTimeLineControls(true);
	}

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

	worker.selectionUpdateHandlers = function(selection,actionObject, key, subkey){
	  $(selection).blur(function(){
	    if(subkey){
	      var typedReturn = worker.typeFunctions(actionObject[key][subkey], $(selection).val());
	      $(selection).val(typedReturn);
	      actionObject[key][subkey] = typedReturn;
	    }
	    else{
	      var typedReturn = worker.typeFunctions(actionObject[key], $(selection).val());
	      $(selection).val(typedReturn);
	      actionObject[key] = typedReturn;
	      if(worker.specialSelectionHandlers[key]){
	      	worker.specialSelectionHandlers[key](actionObject);
	      }
	    }
	    worker.items.update(actionObject);
	  });

	  $(selection).keyup(function(event){
	    if(event.keyCode == 13){
	      if(subkey){
	        var typedReturn = worker.typeFunctions(actionObject[key][subkey], $(selection).val());
	        $(selection).val(typedReturn);
	        actionObject[key][subkey] = typedReturn;
	      }
	      else{
	        var typedReturn = worker.typeFunctions(actionObject[key], $(selection).val());
	        $(selection).val(typedReturn);
	        actionObject[key] = typedReturn;
	        if(worker.specialSelectionHandlers[key]){
	      	worker.specialSelectionHandlers[key](actionObject);
	      	}
	      }
	      worker.items.update(actionObject);
	    }
	  });
	}

	worker.rootNodeIdUpdateHandlers = function(selection){
		$(selection).blur(function(){
	      var typedReturn = worker.typeFunctions(worker.rootAction.id, $(selection).val());
	      $(selection).val(typedReturn);
	      worker.updateRootNodeId(typedReturn);
	  });

	  $(selection).keyup(function(event){
	    if(event.keyCode == 13){
	      var typedReturn = worker.typeFunctions(worker.rootAction.id, $(selection).val());
	      $(selection).val(typedReturn);
	      worker.updateRootNodeId(typedReturn);
	    }
	  });
	}

	worker.updateRootNodeId = function(newId){
		worker.rootAction.id = newId;
		worker.cutSceneID = newId;
		worker.rootAction.childActions.forEach( (childId) =>{
	      	var childObject = worker.getItem(childId);
	      	childObject.parentAction = worker.rootAction.id;
	      	worker.items.update(childObject);
	    });
	}

	worker.typeFunctions = function(target, input){
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
	worker.handleDownload = function(){
		worker.saveCurrentCutScene();
		output = worker.outputState;
		filename = $("#levelName").val();
		download(filename, JSON.stringify(worker.outputState));
	}

	worker.saveCurrentCutScene = function(preservedSelection){
		worker.outputState = worker.outputState || {};
		if(worker.cutSceneID){
			worker.outputState[worker.cutSceneID] = worker.createCutSceneGraph(worker.rootAction);
			worker.cutSceneSelectRedraw();
			if(preservedSelection){
				$("#cutSceneSelect").val(preservedSelection);
			}
		}
	}

	worker.handleChildrenCutSceneGraph = function(actionObject){
		var children = [];
		if(actionObject.childActions){
			actionObject.childActions.forEach( (childObjectId) =>{
				children.push(worker.createCutSceneGraph(worker.getItem(childObjectId)));
			});
		}
		return children; 
	}

	worker.createCutSceneGraph = function(actionObject){
		var output = {};
		for (var key in actionObject){
			output[key] = worker.saveFieldMapping[key] ? worker.saveFieldMapping[key](actionObject): actionObject[key];
		}
		return output;
	}

	worker.loadCutSceneById = function(cutSceneId){
		worker.refresh();
		worker.toggleCreateAction(true);
		worker.cutSceneID = cutSceneId;
		worker.drawCutSceneNameField(cutSceneId);
		worker.parseCutScene(worker.outputState[cutSceneId], true);
		if(worker.currentGroup){
		worker.toggleCreateAction(false);
		}
	};

	worker.createNewCutScene = function(cutSceneId){
		worker.outputState = worker.outputState || {};
		if(worker.outputState[cutSceneId]){
			alert("A Cutscene with name '" + cutSceneId + "' already exists. Please try another name.");
		}
		else{
			worker.refresh();
			worker.groups.add({id: "Main Timeline", content: "Main Timeline"});
			worker.cutSceneID = cutSceneId;
			worker.rootAction = {id: cutSceneId, end: 0, childActions: [], ActionType: worker.CutSceneTypeEnum.StartCutSceneAction};
			worker.saveCurrentCutScene(cutSceneId);
			worker.currentGroup = "Main Timeline";
		}
	}

	worker.parseCutScene = function(cutSceneJSONObject, isRoot){
		var loadedObject = {};
		for(var field in cutSceneJSONObject){
			loadedObject[field] = worker.loadFieldMapping[field] ? worker.loadFieldMapping[field](cutSceneJSONObject) : cutSceneJSONObject[field];
		}
		if(isRoot){
			worker.rootAction = loadedObject;
		}
		else{
			worker.items.add(loadedObject);
			worker.actionsCreated++;
		}
		if(cutSceneJSONObject.childActions){
			cutSceneJSONObject.childActions.forEach((childObject) => {
				worker.parseCutScene(childObject);
			});
		}
	}

	worker.handleLoadChildren = function(actionObject){
		var output = [];
		if(actionObject.childActions){
			output = actionObject.childActions.map( (childObject) => {
				return childObject.id;
			});
		}
		return output;
	}

	worker.handleLoadGroup = function(actionObject){
		//append the group to our current selection of groups
		if(!worker.groups.get(actionObject.group) && actionObject.group){
			worker.groups.add({content: actionObject.group, id: actionObject.group});
			if(!worker.currentGroup){
				worker.currentGroup = actionObject.group;
			}
		}
		return actionObject.group;
	}

	worker.receivedFile = function() {           
		worker.refresh();
		worker.toggleTimeLineControls(true);
		worker.outputState = JSON.parse(fr.result);
		worker.cutSceneSelectRedraw();
		var firstToDisplay = $("#cutSceneSelect").val();
		if(firstToDisplay){
			worker.loadCutSceneById(firstToDisplay);
		}
		
		//worker.populate(newState);
  	}
	worker.initializeDownloader = function(){
		$("#btnLoad").click(worker.handleFileSelect);
		$("#btnSave").click(worker.handleDownload);
		//Make sure we don't delete anything by accident
		$("#levelName").focus(function(){
		$("#categorySelect").change();
		});
	}

	return worker;
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


 //-----------------------------------------Initialize Page---------------------------------------
 var csEditor = {};
 $(document).ready(function(){
	csEditor = createCSEditor();
	csEditor.init();
 });

