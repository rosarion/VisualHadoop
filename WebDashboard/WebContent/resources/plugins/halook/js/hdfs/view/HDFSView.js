/*******************************************************************************
 * WGP 0.2 - Web Graphical Platform (https://sourceforge.net/projects/wgp/)
 * 
 * The MIT License (MIT)
 * 
 * Copyright (c) 2012 Acroquest Technology Co.,Ltd.
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 ******************************************************************************/

halook.HDFS.self;
halook.HDFS.angle = 0;
halook.HDFS.unitAngle = 0;
halook.HDFS.centerObject;
halook.HDFS.capacityList = {};
halook.HDFS.usageList = {};
halook.HDFS.rackList = {};
halook.HDFS.angleList = {};
halook.HDFS.center = {};
halook.HDFS.capacity = {};
halook.HDFS.beforeUsage = {};

var HDFSView = wgp.AbstractView
		.extend({
			initialize : function(argument, treeSetting) {
				halook.HDFS.self = this;
				
				this.hdfsDataList_ = {};
				this.hdfsState_ = {};
				this.hostsList_ = [];
				this.lastMeasurementTime_ = 0;
				this.oldestMeasurementTime_ = 0;
				this.capacityMax_ = 1;
				this.treeSettingId_;
				// vars
				// setting view type
				this.viewType = wgp.constants.VIEW_TYPE.VIEW;
				// set bg color and height
				this._initView();

				this.isRealTime = true;

				this.treeSettingId_ = treeSetting.id;

				var appView = wgp.AppView();
				appView.addView(this, this.treeSettingId_ + '%');
				// set paper
				this.render();
				// リアルタイム通信の受け口を作る
				this.registerCollectionEvent();

				// set view size
				this.width = argument["width"];
				this.height = argument["height"];
				var realTag = $("#" + this.$el.attr("id"));
				if (this.width == null) {
					this.width = realTag.width();
				}
				if (this.height == null) {
					this.height = realTag.height();
				}

				this.viewCollection = {};

				this.maxId = 0;
				this.nextId = -1;

				// drawing
				// non-raphael elements
				// add slider
				this._addSlider(this);

				// add div for data node status popup
				this._addStatusPopup();

				var end = new Date();
				var start = new Date(end.getTime() - 15000);
				appView
						.getTermData([ (this.treeSettingId_ + '%') ], start,
								end);

			},
			_staticRender : function() {
				halook.HDFS.centerObject = this.paper
						.circle(
								halook.HDFS.center.x,
								halook.HDFS.center.y,
								halook.hdfs.constants.mainCircle.radius
										* halook.hdfs.constants.mainCircle.innerRate)
						.attr(
								{
									"fill" : halook.hdfs.constants.dataNode.color.good,
									"stroke" : halook.hdfs.constants.dataNode.frameColor
								});

				this.paper.circle(
						halook.HDFS.center.x,
						halook.HDFS.center.y,
						halook.hdfs.constants.mainCircle.radius
								- halook.hdfs.constants.rack.height / 2).attr({
					"stroke" : halook.hdfs.constants.dataNode.frameColor,
					"stroke-width" : halook.hdfs.constants.rack.height / 2
				});

				// data node capacity bars
				this._drawCapacity();

				// rack
				this._drawRack();

				this._drawUsage();

			},
			render : function() {
				// set paper
				this.paper = new Raphael(document.getElementById(this.$el
						.attr("id")), this.width, this.height);
			},
			onAdd : function(mapElement) {
				this._updateDraw();
				this._animateBlockTransfer();
			},
			onChange : function(mapElement) {
				this.viewCollection[mapElement.id].update(mapElement);
			},
			onRemove : function(mapElement) {
				var objectId = mapElement.get("objectId");
				this.viewCollection[objectId].remove(mapElement);
				delete this.viewCollection[objectId];
			},
			getTermData : function() {
				this._updateDraw();
				if (this.isRealTime) {
					appView.syncData([ (this.treeSettingId_ + "%") ]);
				}
				this._animateBlockTransfer();
			},
			_initView : function() {
				// enlarge area
				$("#contents_area_0").css("height", 600);

				// set bg olor
				$("#" + this.$el.attr("id")).css("background-color",
						halook.hdfs.constants.bgColor);
			},
			_setHdfsDataList : function() {
				var instance = this;
				// delete data ignore old last update date.
				var tmpUpdateLastTime = 0;
				_.each(this.hdfsDataList_, function(data, time) {
					var tmpTime = parseInt(time);
					if (tmpUpdateLastTime < tmpTime) {
						tmpUpdateLastTime = tmpTime;
					}
				});

				if (tmpUpdateLastTime != 0) {
					this.oldestMeasurementTime_ = tmpUpdateLastTime;
					_.each(this.hdfsDataList_, function(data, time) {
						var tmpTime = parseInt(time);
						if (tmpUpdateLastTime != tmpTime) {
							delete instance.hdfsDataList_[time];
						}
					});
				}

				// create lastupdate data.
				var lastupdateTime = 0;
				// search lastMeasurementTime
				_.each(this.collection.models,
						function(model, id) {
							var measurementTime = model
									.get(halook.ID.MEASUREMENT_TIME);
							var tmpTime = parseInt(measurementTime);
							if (lastupdateTime < tmpTime) {
								lastupdateTime = tmpTime;
							}
						});
				// set Last Update Time.
				this.lastMeasurementTime_ = lastupdateTime;

				// delete data
				var lastupdatestartTime = lastupdateTime
						- halook.HDFS.MESURE_TERM;
				var removeTargetList = [];
				_.each(this.collection.models,
						function(model, id) {
							var measurementTime = model
									.get(halook.ID.MEASUREMENT_TIME);
							var tmpTime = parseInt(measurementTime);
							if (lastupdatestartTime > tmpTime) {
								removeTargetList.push(model);
							}
						});
				this.collection.remove(removeTargetList, {
					silent : true
				})
				// create measurement data set.
				_
						.each(
								this.collection.models,
								function(model, id) {
									var measurementItemName = model
											.get(halook.ID.MEASUREMENT_ITEM_NAME);
									var measurementItemNameSplit = measurementItemName
											.split("/");
									var hostname = measurementItemNameSplit[2];
									var valueType = measurementItemNameSplit[3];
									var measurementValue = Number(model
											.get(halook.ID.MEASUREMENT_VALUE));
									if (instance.hdfsDataList_[instance.lastMeasurementTime_]) {
										if (instance.hdfsDataList_[instance.lastMeasurementTime_][hostname]) {

										} else {
											instance.hdfsDataList_[instance.lastMeasurementTime_][hostname] = {};
										}
										instance.hdfsDataList_[instance.lastMeasurementTime_][hostname][valueType] = measurementValue;
										instance.hdfsDataList_[instance.lastMeasurementTime_][hostname]["capacity"] = instance.hdfsDataList_[instance.lastMeasurementTime_][hostname]["dfsremaining"]
												+ instance.hdfsDataList_[instance.lastMeasurementTime_][hostname]["dfsused"];

									} else {
										instance.hdfsDataList_[instance.lastMeasurementTime_] = {};
										var entry = {};
										entry[valueType] = measurementValue;
										entry["capacity"] = measurementValue;
										instance.hdfsDataList_[instance.lastMeasurementTime_][hostname] = entry;
									}
								});
			},
			_animateBlockTransfer : function() {
				for ( var i = 0; i < this.numberOfDataNode; i++) {
					// prepare temporary vars in order to make codes readable
					var host = this.hostsList_[i];
					
					if (halook.HDFS.usageList[host] != undefined) {
					
						var h = this.hdfsState_[host].dfsusedLength;
						var centerX = halook.HDFS.center.x;
						var centerY = halook.HDFS.center.y;
						
						// 前回の使用量ｋ
						var beforeUsage = halook.HDFS.beforeUsage[host];
						if (beforeUsage < h) {
							
							var usageClone = halook.HDFS.usageList[host].clone();
							
							var centerObjectClone = this.paper
							.path(
									[
											[
													"M",
													centerX,
													centerY ] ])
							.attr(
									{
										stroke : halook.hdfs.constants.dataNode.frameColor,
										fill : " rgb(256, 256, 256)"
									});
							
							
							
							usageClone.stop().animate({path: "M" + centerX + " "
								+ centerY, fill: " rgb(256, 256, 256)"}, 1000, "");
						
						} else if (beforeUsage > h) {
							var centerObjectClone = this.paper
								.path(
										[
												[
														"M",
														centerX,
														centerY ] ])
								.attr(
										{
											stroke : halook.hdfs.constants.dataNode.frameColor,
											fill : " rgb(256, 256, 256)"
										});

							
							var pathValue = halook.HDFS.usageList[host].attrs;				
							
							centerObjectClone.stop().animate(pathValue, 1000, "", function() {
								centerObjectClone.remove();
							});
						}
					}
					halook.HDFS.beforeUsage[host]　= h;
				}
			},
			_setHdfsState : function() {
				// set hdfsState as the last data in hdfsDataList
				if (this.hdfsDataList_[this.lastMeasurementTime_]) {
					this.hdfsState_ = this.hdfsDataList_[this.lastMeasurementTime_];
				} else {
					this.hdfsState_ = {};
				}

				// set hostsList
				this.hostsList_ = [];
				for ( var host in this.hdfsState_) {
					if (host != halook.hdfs.constants.hostnameAll) {
						this.hostsList_.push(host);

						// set capacityMax
						if (this.hdfsState_[host]["capacity"] > this.capacityMax_) {
							this.capacityMax_ = this.hdfsState_[host]["capacity"];
						}
					}
				}

				// set the length to display
				for ( var host in this.hdfsState_) {
					this.hdfsState_[host].capacityLength = halook.hdfs.constants.dataNode.maxLength
							* this.hdfsState_[host]["capacity"]
							/ this.capacityMax_;
					this.hdfsState_[host].dfsusedLength = halook.hdfs.constants.dataNode.maxLength
							* this.hdfsState_[host]["dfsused"]
							/ this.capacityMax_;
					if (this.hdfsState_[host]["dfsused"] / this.capacityMax_ > halook.hdfs.constants.blockTransfer.colorThreshold) {
						this.hdfsState_[host].status = halook.hdfs.constants.dataNode.status.full;
					} else {
						this.hdfsState_[host].status = halook.hdfs.constants.dataNode.status.good;
					}
				}
			},
			_addSlider : function(self) {
				$("#" + this.$el.attr("id")).parent().prepend(
						'<div id="slider"></div>');
				$('#slider').css(halook.nodeinfo.parent.css.dualSliderArea);
				$('#slider').css(halook.nodeinfo.parent.css.dualSliderArea);
				this.singleSliderView = new halook.SingleSliderView({
					id : "slider",
					rootView : this
				});

				this.singleSliderView.setScaleMovedEvent(function(pastTime) {
					self.updateDisplaySpan(pastTime);
				});
			},
			_addStatusPopup : function() {
				// hidden div for data node info popup
				$("#" + this.$el.attr("id"))
						.parent()
						.prepend(
								'<div id="nodeStatusBox" '
										+ 'style="padding:10px; color:white; position:absolute; '
										+ 'border:white 2px dotted; display:none">'
										+ '</div>');
			},
			_addClusterStatus : function() {
				// div for cluster status
				$("#" + this.$el.attr("id"))
						.parent()
						.prepend(
								'<div style="padding:10px; background-color:rgba(255,255,255,0.9);">'
										+ '<b>'
										+ 'Cluster Status : '
										+ '</b>'
										+ '<span id="clusterStatus">'
										+ 'total capacity : 1TB, name node : 100, data node : 100'
										+ '</span>' + '</div>');
			},
			_killAnimation : function() {
				// stop animation
				clearInterval(this.timerDn);
				clearInterval(this.timerBt);
			},
			_drawStaticDataNode : function(pastTime) {
				var end = new Date(new Date().getTime() - pastTime);
				var start = new Date(end.getTime() - 60 * 60 * 1000);
				appView.stopSyncData([ (this.treeSettingId_ + '%') ]);
				appView
						.getTermData([ (this.treeSettingId_ + '%') ], start,
								end);
			},
			_addBlockTransfer : function(self) {
				for ( var i = 0; i < self.numberOfDataNode; i++) {
					self.transfer[i] = {};
					self.nextId = self._getUniqueId();
					self.transfer[i].objectId = self.transfer[i].id = self.nextId;
					self.transfer[i].size = 1;// 0;//self.diff[i];
					self.transfer[i].angle = self.angleUnit * i,
							self.blockTransferIdManager.add(self.nextId,
									this.hostsList_[i]);
				}
				_.each(self.transfer, function(obj) {
					obj.type = wgp.constants.CHANGE_TYPE.ADD;
					obj.objectName = "BlockTransferAnimation";
					obj.center = self.center;
					obj.width = 4;
				});
			},
			_updateBlockTransfer : function(self) {
				for ( var i = 0; i < self.numberOfDataNode; i++) {
					self.transfer[i].objectId = self.transfer[i].id = self.blockTransferIdManager
							.find(this.hostsList_[i]);
					self.transfer[i].size = self.diff[i];
				}
				_.each(self.transfer, function(obj) {
					obj.type = self.blockTransferChangeType;
				});
			},
			_addDataNode : function(self) {
				for ( var i = 0; i < self.numberOfDataNode; i++) {
					self.nextId = self._getUniqueId();
					self.currentDataNode[i] = {
						objectId : self.nextId,
						id : self.nextId,
						width : self.dataNodeBarWidth,
						height : this.hdfsState_[this.hostsList_[i]].dfsusedLength,
						angle : self.angleUnit * i,
						host : this.hdfsState_[this.hostsList_[i]],
						capacity : this.hdfsState_[this.hostsList_[i]].capacityLength,
						type : wgp.constants.CHANGE_TYPE.ADD,
						objectName : "DataNodeRectangle",
						center : self.center
					};
					self.dataNodeIdManager.add(self.nextId, this.hostsList_[i]);
				}
			},
			_updateDataNode : function(self) {
				for ( var i = 0; i < self.numberOfDataNode; i++) {

					if (this.hdfsState_[this.hostsList_[i]] != undefined) {
						self.diff[i] = this.hdfsState_[this.hostsList_[i]].dfsusedLength
								- self.currentDataNode[i].height;
						self.currentDataNode[i] = {
							type : wgp.constants.CHANGE_TYPE.UPDATE,
							objectId : self.dataNodeIdManager
									.find(this.hostsList_[i]),
							id : self.dataNodeIdManager
									.find(this.hostsList_[i]),
							height : this.hdfsState_[this.hostsList_[i]].dfsusedLength,
							diff : self.diff[i]
						};
					}
				}
			},
			_getUniqueId : function() {
				// return next id
				this.nextId++;
				return this.nextId;
			},
			_drawCapacity : function() {
				// prepare temporary vars in order to make codes readable
				var r = halook.hdfs.constants.mainCircle.radius;
				var w = this.dataNodeBarWidth;

				for ( var i = 0; i < this.numberOfDataNode; i++) {
					// prepare temporary vars in order to make codes readable
					var host = this.hostsList_[i];
					var capacity = this.hdfsState_[host].capacityLength;
					var angle = this.angleUnit * i + utility.toRadian(90);
					var cos = Math.cos(angle);
					var sin = Math.sin(angle);
					var c = halook.HDFS.center;
					// actual process
					halook.HDFS.capacityList[host] = this.paper
							.path(
									[
											[
													"M",
													(c.x + r * cos + w / 2
															* sin),
													(c.y - r * sin + w / 2
															* cos) ],
											[ "l", (capacity * cos),
													(-capacity * sin) ],
											[ "l", (-w * sin), (-w * cos) ],
											[ "l", (-capacity * cos),
													(capacity * sin) ] ])
							.attr(
									{
										target : host,
										stroke : halook.hdfs.constants.dataNode.frameColor,
										fill : " rgb(48, 50, 50)",
										title : this.hostsList_[i]
												+ " : remaining"
									});

				}
				
				var changedAngle = halook.HDFS.angle;

				for ( var host in halook.HDFS.capacityList) {
					var capacityObject = halook.HDFS.capacityList[host];

					capacityObject.animate({
						transform : "r"
								+ [ halook.HDFS.angle, halook.HDFS.center.x,
										halook.HDFS.center.y ]
					});
				}
			},
			_drawUsage : function() {
				// prepare temporary vars in order to make codes readable
				var r = halook.hdfs.constants.mainCircle.radius;
				var w = this.dataNodeBarWidth;

				for ( var i = 0; i < this.numberOfDataNode; i++) {
					// prepare temporary vars in order to make codes readable
					var host = this.hostsList_[i];
					var h = this.hdfsState_[host].dfsusedLength;
					var angle = this.angleUnit * i + utility.toRadian(90);
					var cos = Math.cos(angle);
					var sin = Math.sin(angle);
					var c = halook.HDFS.center;
					var dfsStatus = this.hdfsState_[host].status;
					// actual process
					halook.HDFS.usageList[host] = this.paper.path(
							[
									[ "M", (c.x + r * cos + w / 2 * sin),
											(c.y - r * sin + w / 2 * cos) ],
									[ "l", (h * cos), (-h * sin) ],
									[ "l", (-w * sin), (-w * cos) ],
									[ "l", (-h * cos), (h * sin) ] ]).attr({
						"stroke" : halook.hdfs.constants.dataNode.frameColor,
						fill : this._getDataNodeColor(dfsStatus),
						target : host,
						title : this.hostsList_[i] + " : used"
					});
				}
				
				var changedAngle = halook.HDFS.angle;

				for ( var host in halook.HDFS.usageList) {
					var usageObject = halook.HDFS.usageList[host];
					usageObject.animate({
						transform : "r"
								+ [ halook.HDFS.angle, halook.HDFS.center.x,
										halook.HDFS.center.y ]
					});
				}
			},
			_setRotationButton : function() {
				var butt1 = this.paper.set(),
				butt2 = this.paper.set();
				butt1.push(this.paper.circle(24.833, 26.917, 26.667).attr({stroke: "#ccc", fill: "#fff", "fill-opacity": .4, "stroke-width": 2}),
				this.paper.path("M12.582,9.551C3.251,16.237,0.921,29.021,7.08,38.564l-2.36,1.689l4.893,2.262l4.893,2.262l-0.568-5.36l-0.567-5.359l-2.365,1.694c-4.657-7.375-2.83-17.185,4.352-22.33c7.451-5.338,17.817-3.625,23.156,3.824c5.337,7.449,3.625,17.813-3.821,23.152l2.857,3.988c9.617-6.893,11.827-20.277,4.935-29.896C35.591,4.87,22.204,2.658,12.582,9.551z").attr({stroke: "none", fill: "#000"}),
				this.paper.circle(24.833, 26.917, 26.667).attr({fill: "#fff", opacity: 0}));
				butt2.push(this.paper.circle(24.833, 26.917, 26.667).attr({stroke: "#ccc", fill: "#fff", "fill-opacity": .4, "stroke-width": 2}),
				this.paper.path("M37.566,9.551c9.331,6.686,11.661,19.471,5.502,29.014l2.36,1.689l-4.893,2.262l-4.893,2.262l0.568-5.36l0.567-5.359l2.365,1.694c4.657-7.375,2.83-17.185-4.352-22.33c-7.451-5.338-17.817-3.625-23.156,3.824C6.3,24.695,8.012,35.06,15.458,40.398l-2.857,3.988C2.983,37.494,0.773,24.109,7.666,14.49C14.558,4.87,27.944,2.658,37.566,9.551z").attr({stroke: "none", fill: "#000"}),
				this.paper.circle(24.833, 26.917, 26.667).attr({fill: "#fff", opacity: 0}));
				butt1.translate(30, 30);
				butt2.translate(810, 30); 
				
				butt1.click(function(event) {
					halook.HDFS.angle -= halook.HDFS.unitAngle;
					halook.HDFS.self._rotateNode();
				}).mouseover(function () {
					butt1[1].animate({fill: "#fc0"}, 300);
				}).mouseout(function () {
					butt1[1].stop().attr({fill: "#000"});
				});
				
				butt2.click(function(event) {
					halook.HDFS.angle += halook.HDFS.unitAngle;
					halook.HDFS.self._rotateNode();
				}).mouseover(function () {
					butt2[1].animate({fill: "#fc0"}, 300);
				}).mouseout(function () {
					butt2[1].stop().attr({fill: "#000"});
				});
				
			},
			_drawRack : function() {
				// prepare temporary vars in order to make codes readable
				var r = halook.hdfs.constants.mainCircle.radius;
				var w = this.dataNodeBarWidth;
				var lastRack = "";
				var numberOfRackColor = halook.hdfs.constants.rack.colors.length;
				var colorNo = -1;

				for ( var i = 0; i < this.numberOfDataNode; i++) {
					if (lastRack != "default") {
						colorNo++;
						lastRack = "default";
					}
					// prepare temporary vars in order to make codes readable
					var host = this.hostsList_[i]
					var h = halook.hdfs.constants.rack.height;
					var angle = this.angleUnit * i + utility.toRadian(90);
					var cos = Math.cos(angle);
					var sin = Math.sin(angle);
					var c = halook.HDFS.center;
					// actual process
					halook.HDFS.rackList[host] = this.paper
							.path(
									[
											[
													"M",
													(c.x + (r - h) * cos + w
															/ 2 * sin),
													(c.y - (r - h) * sin + w
															/ 2 * cos) ],
											[ "l", (h * cos), (-h * sin) ],
											[ "l", (-w * sin), (-w * cos) ],
											[ "l", (-h * cos), (h * sin) ] ])
							.attr(
									{
										target : host,
										stroke : halook.hdfs.constants.rack.colors[colorNo
												% numberOfRackColor],
										fill : halook.hdfs.constants.rack.colors[colorNo
												% numberOfRackColor],
										title : this.hostsList_[i] + " : rack"
									});

				}
				
				var changedAngle = halook.HDFS.angle;

				for ( var host in halook.HDFS.rackList) {
					var rackObject = halook.HDFS.rackList[host];
					rackObject.animate({
						transform : "r"
								+ [ halook.HDFS.angle, halook.HDFS.center.x,
										halook.HDFS.center.y ]
					});
				}
			},
			_rotateNode : function(clickObject) {
				var centerX = halook.HDFS.center.x;
				var centerY = halook.HDFS.center.y;
				for ( var host in halook.HDFS.capacityList) {
					halook.HDFS.capacityList[host].animate({
						transform : "r"
								+ [ halook.HDFS.angle, centerX, centerY ]
					}, 1000, "<>");
					halook.HDFS.usageList[host].animate({
						transform : "r"
								+ [ halook.HDFS.angle, centerX, centerY ]
					}, 1000, "<>");
					halook.HDFS.rackList[host].animate({
						transform : "r"
								+ [ halook.HDFS.angle, centerX, centerY ]
					}, 1000, "<>");
				}
			},
			_initIdManager : function() {
				// id manager prototype
				function IdManager() {
					this.ids = [];
					this.add = function(number, host) {
						this.ids[host] = number;
					};
					this.remove = function(host) {
						delete (this.ids[number]);
					};
					this.find = function(host) {
						return this.ids[host];
					};
				}

				// obj in order to manage relation between id numbers with data
				// node
				this.dataNodeIdManager = new IdManager();
				// obj in order to manage relation between id numbers with block
				// transfer
				this.blockTransferIdManager = new IdManager();
			},
			updateDisplaySpan : function(pastTime) {
				if (pastTime == 0) {

					if (this.isRealTime == false) {
						appView.syncData([ (this.treeSettingId_ + "%") ]);
					}
					this.isRealTime = true;

					var end = new Date();
					var start = new Date(end.getTime() - 60 * 60 * 1000);
					appView.getTermData([ (this.treeSettingId_ + '%') ], start,
							end);
				} else {
					this.isRealTime = false;
					this._drawStaticDataNode(pastTime);
				}

			},
			_updateDraw : function() {

				this._setHdfsDataList();

				var localHdfsLastData = this.hdfsDataList_[this.lastMeasurementTime_];
				var mapSize = 0;
				var mapId = "";
				_.each(localHdfsLastData, function(value, id) {
					mapId = id;
					mapSize++;
				});

				if (mapSize == 1 && mapId == halook.hdfs.constants.hostnameAll) {
					return;
				}

				this.paper.clear();
				
				this._setRotationButton();

				// set hdfsState as the last data in hdfsDataList
				this._setHdfsState();

				// data node
				this.numberOfDataNode = this.hostsList_.length;

				if (this.numberOfDataNode != 0) {
					halook.HDFS.unitAngle = 360 / this.numberOfDataNode;
				} else {
					halook.HDFS.unitAngle = 0;
				}

				this.dataNodeBarWidth = halook.hdfs.constants.mainCircle.radius
						* 2 * Math.PI / this.numberOfDataNode;
				if (this.dataNodeBarWidth > halook.hdfs.constants.dataNode.maxWidth) {
					this.dataNodeBarWidth = halook.hdfs.constants.dataNode.maxWidth;
				}
				this.dataNodeChangeType = wgp.constants.CHANGE_TYPE.ADD;

				// base numbers for drawing
				halook.HDFS.center = {
					x : viewArea2.width / 2,
					y : viewArea2.height / 2 - 90
				};
				this.angleUnit = utility.toRadian(360 / this.numberOfDataNode);

				// block transfer
				this.blockTransferChangeType = wgp.constants.CHANGE_TYPE.ADD;

				// id manager
				this._initIdManager();

				// raphael elements
				// static objects
				this._staticRender();

			},
			_getDataNodeColor : function(status) {
				if (status == halook.hdfs.constants.dataNode.status.good) {
					return halook.hdfs.constants.dataNode.color.good;
				} else if (status == halook.hdfs.constants.dataNode.status.full) {
					return halook.hdfs.constants.dataNode.color.full;
				} else {
					return halook.hdfs.constants.dataNode.color.dead;
				}
			},
			_notifyToThisView : function(data) {
				var addData = [ {
					windowId : windowId,
					data : data
				} ];
				appView.notifyEvent(addData);
			}
		});

_.bindAll(wgp.MapView);