/*
 * Declaration of class LifeCycleModel
 */
LifeCycleModel = function(canvas) {
	this.paper = new paper.PaperScope();
	this.paper.setup(canvas);

	this.places = [];
	this.transitions = [];
	this.grid_size = new this.paper.Point(1, 1);

	console.log("Created new life cycle model");

	this.transitionInProgress = false;
	this.currentMovements = [];
	this.expectedMovements = 0;
	this.movementsDone = 0;

	var lcm = this;
	this.paper.view.onFrame = function(event) {
		for(var i = 0; i < lcm.currentMovements.length; i++) {
			// Leave the previous token a few steps ahead
			if(i > 0 && lcm.currentMovements[i-1].iterations <= 5)
				continue;

			var movement = lcm.currentMovements[i];
			var token = movement.token;
			var path = movement.path;

			token.moveTo(path.getPointAt(path.length / LifeCycleModel.animation_iterations * movement.iterations), true);
			if(++movement.iterations >= LifeCycleModel.animation_iterations) {
				// This animation is done
				lcm.currentMovements.splice(i, 1);
				
				if(movement.removeToken)
					token.shape.remove();

				if(++lcm.movementsDone == lcm.expectedMovements) {
					lcm.expectedMovements = 0;
					lcm.movementsDone = 0;
					movement.transition.__allMovementsDone();
				}
				else {
					console.log(lcm.movementsDone + '/' + lcm.expectedMovements);
				}
			}
		}
	}
}

LifeCycleModel.place_radius = 13;
LifeCycleModel.transition_width = 10;
LifeCycleModel.transition_height = 30;
LifeCycleModel.token_radius = 2.5;
LifeCycleModel.animation_iterations = 20;

LifeCycleModel.label_distance = 30;
LifeCycleModel.place_label_font_family = 'sans-serif';
LifeCycleModel.transition_label_font_family = 'sans-serif';
LifeCycleModel.label_font_size = '10pt';
LifeCycleModel.label_font_weight = 'normal';
LifeCycleModel.token_count_font_size = '10pt';
LifeCycleModel.token_count_font_family = 'sans-serif';
LifeCycleModel.token_count_font_weight = 'bold';

LifeCycleModel.prototype = {
		draw: function() {
			this.paper.view.draw();
		},

		zoom: function(factor) {
			this.paper.view.zoom = factor;
		},

		center: function(x, y) {
			this.paper.view.center = new this.paper.Point(x, y).multiply(this.grid_size);
		},

		/*
		 * Method LifeCycleModel.addPlace(name, x, y) or
		 * addPlace(object) where object is
		 * {
		 * 		name: string,
		 * 		position: {x, y},
		 * 		[labelPosition: above|right|below|left]
		 * }
		 */
		addPlace: function(name, x, y) {
			var p = new Place(this, name, x, y);
			p.draw();
			this.places[this.places.length] = p;

			return p;
		},

		/*
		 * Method LifeCycleModel.addTransition()
		 */
		addTransition: function(name, x, y) {
			var t = new Transition(this, name, x, y);
			t.draw();
			this.transitions[this.transitions.length] = t;

			return t;
		},

		/*
		 * Method LifeCycleModel.addArc(from, to, arity) or
		 * addArc({
		 * 		from: Point,
		 * 		to: Point,
		 * 		[arity: int,]
		 * 		[bend: left|right]
		 * });
		 */
		addArc: function(from, to, arity) {
			bend = undefined;

			// Points have a Place or Transition object, regular objects don't have this property
			// TODO this is terrible design
			if(!('parent' in from)) {
				args = from;
				from = args.from;
				to = args.to;
				arity = args.arity;
				bend = args.bend;
			}

			if(typeof(arity)  === 'undefined')
				arity = 1;

			var vector = to.subtract(from);
			var arrowVector = vector.normalize(5);

			// The straight lines
			var line = new this.paper.Path([from, to]);
			var arrowHead = new this.paper.Path({
				segments: [to.add(arrowVector.rotate(135)),
				           to.add(arrowVector.rotate(-135)),
				           to],
				           closed: true,
				           fillColor: '#000000'
			}); 

			// Bend left?
			if(bend === 'left') {
				// Bend the line
				var p1 = to.rotate(-30, from);
				var p2 = from.rotate(30, to);
				var path1 = new this.paper.Path(from, p1);
				var path2 = new this.paper.Path(to, p2);
				var i = path1.getIntersections(path2)[0].point;
				
				//line = new this.paper.Path.Arc(from, i, to);
				line = new this.paper.Path(from);
				line.curveTo(i, to);

				// Bend the head
				arrowHead.rotate(45);
			}

			// Bend right?
			if(bend === 'right') {
				// Bend the line
				var p1 = to.rotate(-30, from);
				var p2 = from.rotate(30, to);
				var path1 = new this.paper.Path(from, p1);
				var path2 = new this.paper.Path(to, p2);
				var i = path1.getIntersections(path2)[0].point;
				line = new this.paper.Path.Arc(from, i, to);

				// Bend the head
				arrowHead.rotate(-45);
			}

			arc = new this.paper.Group([line, arrowHead]);
			arc.strokeWidth = 1;
			arc.strokeColor = '#000000';

			// Connect the line to the place and transition
			if(from.parent instanceof Transition) { // From is a transition
				from.parent.postArcs[from.parent.postArcs.length] = line;
			}

			if(to.parent instanceof Transition) { // From is a place
				to.parent.preArcs[to.parent.preArcs.length] = line;
			}

			line.source = from.parent;
			line.destination = to.parent;
			line.arity = arity;
		},
		
		reset: function() {
			this.currentMovements = [];
			for(var i = 0; i < this.places.length; i++)
				this.places[i].clear();
			this.places[0].addToken();
			console.log("PNet cleared!")
		}
}

/*
 * Base class for elements in a LifeCycleModel
 */
function Entity(lcm, name, x, y) {
	/*
	 * Constructor
	 * Arguments can be (name, x, y) or an object.
	 */
	args = name;
	if(!(name instanceof Object)) {
		args = {name: name, position: {x: x, y: y}};
	}

	this.lcm = lcm;
	this.name = args.name;
	this.center = new lcm.paper.Point(args.position.x, args.position.y);

	if(typeof args.labelPosition === 'undefined')
		args.labelPosition = 'below';

	switch(args.labelPosition) {
	case "above":
		this.label_shift = new lcm.paper.Point(0, -LifeCycleModel.label_distance);
		break;
	case "right":
		this.label_shift = new lcm.paper.Point(LifeCycleModel.label_distance, 0);
		break;
	case "below":
		this.label_shift = new lcm.paper.Point(0, LifeCycleModel.label_distance);
		break;
	case "left":
		this.label_shift = new lcm.paper.Point(-LifeCycleModel.label_distance, 0);
		break;
	default:
		throw "Invalid position: '" + args.labelPosition + "'. Possible values are: 'above', 'right', 'below' or 'left'.";
	}
}

Entity.prototype = {
		/*
		 * Method Entity.draw()
		 * Does nothing, as we don't know how to draw a generic entity.
		 */
		draw: function() {
			console.log("Drawing " + this.name + " at " + this.x + "," + this.y);
		},

		/*
		 * Draw this entity's label around it (below by default).
		 */
		drawLabel: function() {
			new this.lcm.paper.PointText({
				point: this.shape.position.add(this.label_shift),
				content: this.name,
				fillColor: '#000000',
				fontFamily: LifeCycleModel.label_font_family,
				fontSize: LifeCycleModel.label_font_size,
				fontWeight: LifeCycleModel.label_font_weight,
				justification: 'center'
			});
		},

		/*
		 * Store the shape drawing this entity.
		 */
		setShape: function(shape) {
			this.shape = shape;

			this.north = new this.lcm.paper.Point(shape.position.x, shape.position.y - this.y_shift);
			this.east = new this.lcm.paper.Point(shape.position.x + this.x_shift, shape.position.y);
			this.south = new this.lcm.paper.Point(shape.position.x, shape.position.y + this.y_shift);
			this.west = new this.lcm.paper.Point(shape.position.x - this.x_shift, shape.position.y);

			this.north.parent = this;
			this.east.parent = this;
			this.south.parent = this;
			this.west.parent = this;
		}
}


/*
 * Class Place inherits from Entity
 */
function Place(lcm, name, x, y) {
	Entity.call(this, lcm, name, x, y);

	this.x_shift = LifeCycleModel.place_radius;
	this.y_shift = LifeCycleModel.place_radius;
	this.label_font_family = LifeCycleModel.place_label_font_family;

	this.tokenCountShape = new lcm.paper.PointText({
		point: [0, 0],
		content: "",
		fillColor: '#000000',
		justification: 'center',
		fontSize: LifeCycleModel.token_count_font_size,
		fontFamily: LifeCycleModel.token_count_font_family,
		fontWeight: LifeCycleModel.token_count_font_weight
	});

	this.tokens = [];
}

Place.prototype = Object.create(Entity.prototype, {
	/*
	 * Method Place.draw()
	 */
	draw: {
		value: function() {
			// Draw the place
			var center = this.center.multiply(this.lcm.grid_size);
			var c = new this.lcm.paper.Path.Circle({
				center: center,
				radius: LifeCycleModel.place_radius,
				strokeColor: '#000000'
			});
			this.setShape(c);

			// Draw the label
			this.drawLabel();

			return c;
		}
	},

	/*
	 * Method Place.addToken()
	 */
	addToken: {
		value: function() {
			this.tokens[this.tokens.length] = new Token(this.lcm, this.shape.position);
			this.layoutTokens();
		}
	},
	
	clear: {
		value: function() {
			for(var i = 0; i < this.tokens.length; i++) {
				this.tokens[i].shape.remove();
			}
			this.tokens = [];
		}
	},

	layoutTokens: {
		value: function() {
			var n_tokens = this.tokens.length;
			// If there are more than 5 tokens, don't draw them
			if(n_tokens > 5) {
				this.drawTokenCount();
				return;
			}

			this.tokenCountShape.visible = false;
			this.tokens[0].moveTo(this.shape.position);
			for(var i = 1; i < n_tokens; i++) {
				var p = this.shape.position.add(new this.lcm.paper.Point(0, 7));
				this.tokens[i].moveTo(p.rotate((360 / n_tokens) * i, this.shape.position));
			}
		}
	},

	drawTokenCount: {
		value: function() {
			var n_tokens = this.tokens.length;

			for(var i = 0; i < n_tokens; i++)
				this.tokens[i].shape.visible = false;

			this.tokenCountShape.content = "" + n_tokens;
			this.tokenCountShape.position.x = this.shape.position.x;
			this.tokenCountShape.position.y = this.shape.position.y;
			this.tokenCountShape.visible = true;
		}
	}
});

Place.prototype.constructor = Place;


/*
 * Class Transition inherits from Entity
 */
function Transition(lcm, name, x, y) {
	Entity.call(this, lcm, name, x, y);

	this.x_shift = LifeCycleModel.transition_width / 2;
	this.y_shift = LifeCycleModel.transition_height / 2;
	this.label_font_family = LifeCycleModel.transition_label_font_family;

	// A transition maintains a set of pre and post arcs
	this.preArcs = [];
	this.postArcs = [];
}

Transition.prototype = Object.create(Entity.prototype, {
	/*
	 * Method Transition.draw()
	 */
	draw: {
		value: function() {
			// Draw the transition
			var center = this.center.multiply(this.lcm.grid_size);
			var rect = new this.lcm.paper.Shape.Rectangle({
				center: center,
				size: [LifeCycleModel.transition_width, LifeCycleModel.transition_height],
				strokeColor: '#000000',
				fillColor: '#000000'
			});
			this.setShape(rect);

			// Draw the label
			this.drawLabel();

			return rect;
		}
	},

	/*
	 * Method Transition.trigger()
	 */
	trigger: {
		value: function(doneHandler, doneHandlerArg) {
			// We don't allow more than one transition to be triggered at the same time
			if(this.lcm.transitionInProgress)
				throw "A transition is already being triggered.";
			this.lcm.transitionInProgress = true;
			
			// Save the handler for executing when the transition is done
			this.doneHandler = doneHandler;
			this.doneHandlerArg = doneHandlerArg;

			try {
				// Check this transition can actually be triggered
				for(var i = 0; i < this.preArcs.length; i++) {
					if(this.preArcs[i].arity < this.preArcs[i].source.tokens.length) {
						throw "Transition " + this.name + " is not enabled!";
					}
				}

				// Consume the tokens
				console.log("Triggering " + this.name);
				this.inProgress = true;
				this.lcm.expectedMovements = this.preArcs.reduce(function(prec, cur, index, arr) { return prec + cur.arity; }, 0);
				for(var i = 0; i < this.preArcs.length; i++) {
					for(var j = 0; j < this.preArcs[i].arity; j++) {
						var arc = this.preArcs[i];
						source = arc.source;
						
						if(source.tokens[0] === undefined) {
							console.log("Token is undefined!");
							console.log("There are " + source.tokens.length + " tokens on place " + source.name);
							for(var k = 0; k < source.tokens.length; k++) {
								console.log("Token " + k + ": " + source.tokens[k]);
							}
						}
						
						// Add the path to the list of current movements
						this.lcm.currentMovements[this.lcm.currentMovements.length] = new TokenMovement(source.tokens[0], arc, this, true);

						// Remove the token from the source place, so it won't be consumed again
						source.tokens.splice(0, 1);
					}
				}		
			}
			finally {
				// Unlock the model upon failure
				this.lcm.transitionInProgress = false;
			}
		}
	},

	/*
	 * Called by the onFrame method when all tokens are consumed
	 * When the tokens are all consumed, we can produce
	 */
	__allMovementsDone: {
		value: function() {
			// If it is called after the tokens have been produced, simply call the handler
			if(!this.inProgress) {
				this.lcm.transitionInProgress = false;
				if(this.doneHandler !== undefined) {
					console.log("Executing handler for transition " + this.name);
					this.doneHandler(this.doneHandlerArg);
					this.doneHandler = undefined;
					this.doneHandlerArg = undefined;
				}
				return;
			}
			this.inProgress = false;

			// Tokens have been consumed, let's produce
			this.lcm.expectedMovements = this.postArcs.reduce(function(prec, cur, index, arr) { return prec + cur.arity; }, 0);
			for(var i = 0; i < this.postArcs.length; i++) {
				for(var j = 0; j < this.postArcs[i].arity; j++) {
					var arc = this.postArcs[i];
					destination = arc.destination;

					// Construct a path along with the token will travel
					var path = new this.lcm.paper.Path(arc.segments);
					path.add(destination.shape.position);

					// Add the path to the list of current movements
					var token = new Token(this.lcm, this.shape.position.x, this.shape.position.y);
					this.lcm.currentMovements[this.lcm.currentMovements.length] = new TokenMovement(token, path, this);

					// Already add the token to the destination place
					destination.tokens[destination.tokens.length] = token;
					console.log("Produced a token on the " + destination.name + " place. It now contains " + destination.tokens.length + " tokens.");
				}
			}
		}
	}
});

Transition.prototype.constructor = Transition;


function Token(lcm, x, y) {
	// Constructor
	this.position = new lcm.paper.Point(x, y);
	this.shape = new lcm.paper.Shape.Circle({
		center: this.position,
		radius: LifeCycleModel.token_radius,
		strokeColor: '#000000',
		fillColor: '#000000'
	});
}

Token.prototype = {	
		/*
		 * Move the token to a different point
		 */
		moveTo: function(point) {
			this.shape.position = point;
		}
}

function TokenMovement(token, path, transition, removeToken) {
	// Constructor
	this.token = token;
	this.path = path;
	this.iterations = 0;
	this.transition = transition;
	this.removeToken = removeToken;
}


