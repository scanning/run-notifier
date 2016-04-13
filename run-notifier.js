'use strict';

var request = require('request');
var slack;

var platformApiEndpoints = {
	mapmyrun : {
		authorizeUrl : 'https://www.mapmyfitness.com/v7.1/oauth2/uacf/authorize/',
		tokenUrl : 'https://api.ua.com/v7.1/oauth2/uacf/access_token/',
		clientId : '',
		clientSecret : ''
	},
	strava : {
		authorizeUrl : 'https://www.strava.com/oauth/authorize',
		tokenUrl : 'https://www.strava.com/oauth/token',
		clientId : '',
		clientSecret : ''
	}
};

function processIncomingTwilioSMS(to, from, body, callback) {

	console.log('Processing incoming Twilio SMS.');

	var state, response, lcBody = body.toLowerCase();
	if (lcBody === 'mapmyrun' || lcBody === 'strava') {
		state = encodeURIComponent(from);
		response = 'Thanks, let&#39;s get you started with run-notifier by accessing the following: '
				+ platformApiEndpoints[lcBody].authorizeUrl
				+ '?client_id='
				+ platformApiEndpoints[lcBody].clientId
				+ '&amp;response_type=code&amp;state='
				+ state
				+ '&amp;redirect_uri=https%3A%2F%2Fwebtask.it.auth0.com%2Fapi%2Frun%2Fwt-simoncanning-gmail_com-0%2Frun-notifier%3Fwebtask_no_cache%3D1%26src%3D'
				+ lcBody + '%26op%3Dauthorization_redirect';
	} else {
		response = 'To use run-notifier, text the run tracker platform you use. We support MapMyRun and Strava at the moment.';
	}

	console.log('Completed processing incoming Twilio SMS.');

	return callback(null, {
		statusCode : 200,
		contentType : 'application/xml',
		body : '<?xml version="1.0" encoding="UTF-8"?><Response><Sms from="'
				+ to + '" to="' + from + '">' + response + '</Sms></Response>'
	});
}

function storeAccessToken(storage, platform, user, token, callback) {

	console.log('Storing access token for user ' + user + '.');

	storage.get(function(error, data) {
		if (error) {
			return callback(error);
		}
		data[platform + '-' + user] = token;
		storage.set(data, function(error) {
			if (error) {
				return callback(error);
			} else {
				return callback(null, token);
			}
		});
	});
}

function getAccessTokenFromStore(storage, platform, user, callback) {

	console.log('Getting access token for user ' + user + '.');

	storage.get(function(error, data) {
		if (error) {
			return callback(error);
		} else {
			return callback(null, data[platform + '-' + user]);
		}
	});
}

function exchangeCodeForToken(platform, code, callback) {

	console.log('Exchanging code for token at ' + platform + '.');

	request({
		url : platformApiEndpoints[platform].tokenUrl,
		method : 'POST',
		headers : {
			'Api-Key' : platformApiEndpoints[platform].clientId
		},
		form : {
			grant_type : 'authorization_code',
			client_id : platformApiEndpoints[platform].clientId,
			client_secret : platformApiEndpoints[platform].clientSecret,
			code : code,
		}
	},
			function(error, res, body) {

				console.log('Completed exchanging code for token at '
						+ platform + '.');

				if (!error && res.statusCode == 200) {
					return callback(null, JSON.parse(body));
				} else {
					return callback(error);
				}
			});
}

function processStravaAuthorizationRedirect(storage, code, callback) {

	console.log('Processing Strava authorization redirect.');

	exchangeCodeForToken(
			'strava',
			code,
			function(error, data) {
				if (error) {
					return callback(error);
				} else {
					storeAccessToken(
							storage,
							'strava',
							data.athlete.id,
							data.access_token,
							function(error, token) {
								if (error) {
									return callback(error);
								} else {
									return callback(
											null,
											{
												statusCode : 200,
												contentType : 'text/plain',
												body : 'Thanks for registering with run-notifier'
											});
								}
							});
				}
			});
}

function processMapMyRunAuthorizationRedirect(storage, code, callback) {

	console.log('Processing MapMyRun authorization redirect.');

	exchangeCodeForToken(
			'mapmyrun',
			code,
			function(error, data) {
				if (error) {
					return callback(error);
				} else {
					storeAccessToken(
							storage,
							'mapmyrun',
							data.user_id,
							data.access_token,
							function(error, token) {
								if (error) {
									return callback(error);
								} else {
									request(
											{
												url : 'https://oauth2-api.mapmyapi.com/v7.1/webhook/',
												method : 'POST',
												auth : {
													'bearer' : data.access_token
												},
												headers : {
													'Api-Key' : platformApiEndpoints.mapmyrun.clientId,
												},
												json : {
													callback_url : 'https://webtask.it.auth0.com/api/run/wt-simoncanning-gmail_com-0/run-notifier?webtask_no_cache=1&src=mapmyrun&op=webhook',
													subscription_type : 'application.workouts',
													shared_secret : 'a_shared_secret_that_isnt_really_secret'
												}
											},
											function(error, res, body) {
												if (error) {
													return callback(error);
												} else if (res
														&& (res.statusCode == 200 || res.statusCode == 409)) {
													console
															.log('Completed processing MapMyRun authorization redirect.');
													return callback(
															null,
															{
																statusCode : 200,
																contentType : 'text/plain',
																body : 'Thanks for registering with run-notifier'
															});
												} else {
													return callback(
															null,
															{
																statusCode : 501,
																contentType : 'text/plain',
																body : 'Internal server error'
															});
												}
											});
								}
							});
				}
			});
}

function processMapMyRunWorkout(storage, workoutData, callback) {

	console.log('Processing MapMyRun workout.');

	if (!workoutData[0]) {
		return callback(null, {
			statusCode : 202,
			contentType : 'text/plain',
			body : 'Accepted'
		});
	} else if (workoutData[0].type === 'application.workouts') {
		var workout = workoutData['0'];
		getAccessTokenFromStore(
				storage,
				'mapmyrun',
				workout._links.user[0].id,
				function(error, token) {
					if (error) {
						callback(error);
					} else {
						request(
								{
									url : 'https://oauth2-api.mapmyapi.com'
											+ workout._links.workout[0].href,
									method : 'GET',
									auth : {
										'bearer' : token
									},
									headers : {
										'Api-Key' : platformApiEndpoints.mapmyrun.clientId,
									}
								},
								function(error, res, body) {
									if (error) {
										return callback(error);
									} else {
										if (res.statusCode == 200) {
											var parsedBody = JSON.parse(body);
											var text = ' ran '
													+ Math
															.round(parsedBody.aggregates.distance_total / 10)
													/ 100
													+ ' kms in '
													+ parsedBody.aggregates.elapsed_time_total
													/ 60 + ' minutes.'

											request(
													{
														url : 'https://oauth2-api.mapmyapi.com'
																+ workout._links.user[0].href,
														method : 'GET',
														auth : {
															'bearer' : token
														},
														headers : {
															'Api-Key' : platformApiEndpoints.mapmyrun.clientId,
														}
													},
													function(error, res, body) {
														if (error) {
															return callback(error);
														} else {
															console
																	.log('Finished processing MapMyRun workout.');

															if (res.statusCode == 200) {
																var parsedBody = JSON
																		.parse(body);

																slack
																		.alert({
																			channel : '#running',
																			icon_emoji : ':runner:',
																			text : parsedBody.display_name
																					+ ' '
																					+ text,
																			username : 'run-notifier'
																		});
															} else {
																console
																		.log('Received status '
																				+ res.statusCode
																				+ ' from getting user details.');
															}

															return callback(
																	null,
																	{
																		statusCode : 202,
																		contentType : 'text/plain',
																		body : 'Accepted'
																	});
														}
													});

										} else {
											console
													.log('Received status '
															+ res.statusCode
															+ ' from getting workout details.');
										}

										return callback(null, {
											statusCode : 202,
											contentType : 'text/plain',
											body : 'Accepted'
										});
									}
								});
					}
				});
	}
}

module.exports = function(ctx, req, res) {

	var src = ctx.data.src;
	var op = ctx.data.op;
	var state = ctx.data.state;

	slack = require('slack-notify@0.1.4')(ctx.data.SLACK_WEBHOOK_URL);

	platformApiEndpoints.mapmyrun.clientId = ctx.data.UA_CLIENT_ID;
	platformApiEndpoints.mapmyrun.clientSecret = ctx.data.UA_CLIENT_SECRET;

	platformApiEndpoints.strava.clientId = ctx.data.STRAVA_CLIENT_ID;
	platformApiEndpoints.strava.clientSecret = ctx.data.STRAVA_CLIENT_SECRET;

	if (src === 'twilio') {
		processIncomingTwilioSMS(ctx.data.To, ctx.data.From, ctx.data.Body,
				function(error, data) {
					if (error) {
						console.log('An error occurred processing request: '
								+ error);
						res.writeHead(501, {
							'content-type' : 'text/plain'
						});
						return res.end('501 Internal Server Error');
					} else {
						res.writeHead(data.statusCode, {
							'content-type' : data.contentType
						});
						return res.end(data.body);
					}
				});
	} else if (src === 'mapmyrun') {
		if (op === 'authorization_redirect') {

			//
			// Ideally I'd like to handle the OAuth 2.0 authorization endpoint
			// redirect request here. Unfortunately MapMyRun do not preserve
			// query parameters specified on redirect_uri (as per
			// https://tools.ietf.org/html/rfc6749#section-3.1.2) and hence need
			// to use presence of state query parameter to detect this
			// operation. See this handling further down.
			//

		} else if (op === 'webhook') {
			processMapMyRunWorkout(
					ctx.storage,
					ctx.data,
					function(error, data) {
						if (error) {
							console
									.log('An error occurred processing request: '
											+ error);
							res.writeHead(501, {
								'content-type' : 'text/plain'
							});
							return res.end('501 Internal Server Error');
						} else {
							res.writeHead(data.statusCode, {
								'content-type' : data.contentType
							});
							return res.end(data.body);
						}
					});
		} else {
			console.log('Unknown operation ' + op + ' for src ' + src);
		}
	} else if (src === 'strava') {
		if (op === 'authorization_redirect') {

			processStravaAuthorizationRedirect(
					ctx.storage,
					ctx.data.code,
					function(error, data) {
						if (error) {
							res.writeHead(501, {
								'content-type' : 'application/json'
							});
							console
									.log('An error occurred processing request: '
											+ error);
							return res.end({
								'status' : 501,
								'message' : '501 Internal Server Error'
							});
						} else {
							res.writeHead(data.statusCode, {
								'content-type' : data.contentType
							});
							return res.end(data.body);
						}
					});

		} else if (op === 'webhook') {

			//
			// Waiting on Stava to enable webhook notifications for this.
			//

		} else {
			console.log('Unknown operation ' + op + ' for src ' + src);
		}
	} else {
		if (state) {

			//
			// As mentioned, MapMyRun do not preserve query parameters specified
			// on redirect_uri (as per
			// https://tools.ietf.org/html/rfc6749#section-3.1.2) and hence need
			// to use presence of state query parameter to detect this
			// operation.
			//

			processMapMyRunAuthorizationRedirect(
					ctx.storage,
					ctx.data.code,
					function(error, data) {
						if (error) {
							res.writeHead(501, {
								'content-type' : 'application/json'
							});
							console
									.log('An error occurred processing request: '
											+ error);
							return res.end({
								'status' : 501,
								'message' : '501 Internal Server Error'
							});
						} else {
							res.writeHead(data.statusCode, {
								'content-type' : data.contentType
							});
							return res.end(data.body);
						}
					});
		} else {
			console.log('Unknown src ' + src);

			res.writeHead(200, {
				'Content-Type' : 'text/plain'
			});

			return res.end('To start using run-notifier send a text to '
					+ ctx.data.PHONE_NUMBER);
		}
	}
};