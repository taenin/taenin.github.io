var summonerId = 20404838;
var URLprefix = "https://na.api.pvp.net";
var URLgames = "/api/lol/na/v1.3/game/by-summoner/";
var URLgameData = "/api/lol/na/v2.2/match/";
var URLtimeline = "&includeTimeline=true";
var URLrecentSuf="/recent";
var URLkey = "?api_key=9de0181c-92fb-4aa9-86a4-d730008680b6";
var lastGameId = "";

/**Returns the time elapsed between the unix time oldTime and the current time as
	a string. Ex: "1 Day 2 Hours and 5 Seconds"
**/
var dateDif = function(oldTime){
	if(!Date.now){
		Date.now = function(){return new Date().getTime();}
	}
	var delta = (Date.now() - oldTime)/1000; //get time in seconds
	var days=Math.floor(delta / 86400);
	var hours=Math.floor((delta%86400)/3600);
	var minutes=Math.floor((delta%3600)/60);
	var seconds=Math.floor(delta%60);
	output = "";
	if(days>0){
		if(days===1){
			output+= days + " Day "
		}
		else{
			output+= days + " Days "
		}		
	}
	if(hours>0){
		if(hours===1){
			output+= hours + " Hour "
		}
		else{
			output+= hours + " Hours "
		}
		
	}
	if(minutes>0){
		if(minutes===1){
			output+= minutes + " Minute "
		}
		else{
			output+= minutes + " Minutes "
		}
		
	}
	if(output!=""){
		output += " and "
	}
	if(seconds===1){
		output+= seconds + " Second."
	}
	else{
		output+= seconds + " Seconds."
	}
	return output;
};
/**
	Returns the ID of the most recent game in which the target player (given by sumID) died.
	Returns None if the request fails or the player has not died recently.
**/
var recentDeathGameId = function(sumID, wait){
	if(!wait){
		responseWrapper = $.get(URLprefix+URLgames+sumID+URLrecentSuf+URLkey);
		responseObject = responseWrapper.responseJSON;
	}
		if(responseObject.games){
			for(var gameNum = 0; gameNum<responseObject.games.length; gameNum++){
				if(responseObject.games[gameNum].stats.numDeaths > 0){
					return responseObject.games[gameNum].gameId;
				}
			}
		}
		return None;
};

/**
	To be called if a new game is found where the target player died.
**/
var updateGameId = function(gameId){
	if(gameId!=lastGameId){

	}
};
var requestDeathGameId = function(sumID){
	$.ajax({
		url: URLprefix+URLgames+sumID+URLrecentSuf+URLkey,
		dataType: 'json',
		success: checkGameId
	});
};

var checkGameId = function(response){
	if(response.games){
		for(var gameNum = 0; gameNum<response.games.length; gameNum++){
			if(response.games[gameNum].stats.numDeaths > 0){
				if(response.games[gameNum].gameId!=lastGameId){
					$.ajax({
						url: URLprefix+URLgameData+response.games[gameNum].gameId+URLkey+URLtimeline,
						dataType: 'json',
						success: function(res){
							var player = {"teamId": response.games[gameNum].teamId,
										"championId" : response.games[gameNum].championId};
							getDeathData(res, player);
						}
					});
				}					
				break;
			}
		}
	}
}

var getDeathData = function(response, playerData){
	var playerId = getPlayerId(response, playerData);
	var gameData = {"playerData": playerData};
	if(response.timeline && response.timeline.frames && playerId){
		gameData["matchMode"] = response.matchMode;
		gameData["participants"] = response.participants;
		gameData["matchCreation"] = response.matchCreation;
		var fList = response.timeline.frames;
		(function(){
			for(var frameCount = fList.length-1; frameCount>=0; frameCount--){
				var fTime = fList[frameCount];
				if(fTime.events){
					for(var eventsCount = fTime.events.length-1; eventsCount>=0; eventsCount--){
						if(fTime.events[eventsCount].eventType === "CHAMPION_KILL" && fTime.events[eventsCount].victimId===playerId){
							gameData["deathData"] = fTime.events[eventsCount];
							return response.matchCreation + fTime.events[eventsCount].timestamp;
						}
					}
				}
			}
		})();
		alert(dateDif(gameData.matchCreation + gameData.deathData.timestamp));
	}
}

var getPlayerId = function(response, playerData){
	if(response.participants){
		for(var ind=0; ind<response.participants.length; ind++){
			var player = response.participants[ind];
			if(player.championId===playerData.championId && player.teamId===playerData.teamId){
				return player.participantId;
			}
		}
	}
};