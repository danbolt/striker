


let Gameplay = function (config) {
    Phaser.Scene.call(this, config);

    this.score = 0;

    this.player = null;
    this.playerHealth = PLAYER_MAX_HEALTH;
    this.playerAimDir = new Phaser.Math.Vector2(0, -1);
    this.canShoot = true;
    this.keyboard = null;
    this.keys = {};

    this.enemies = null;

    this.playerBullets = null;
    this.enemyBullets = null;

    this.three = null;
    this.camera = new THREE.PerspectiveCamera( 60, GAME_WIDTH / GAME_HEIGHT, 1, 1500 );
    this.renderer = null;
    this.threeScene = new THREE.Scene();
    this.threeScene.fog = new THREE.Fog(0x9999FF, 0, 2500);
    this.threeScene.background = new THREE.Color('#9999FF');
    this.sceneMeshData = {};
    this.enemyMeshPool = {};
    this.bulletMeshPool = {};
    this.mixers = [];

    this.formationData = {};

    this.worldSize = new Phaser.Math.Vector2(DEFAULT_WORLD_SIZE, DEFAULT_WORLD_SIZE);
    this.playerPosition = new Phaser.Math.Vector2(0, 0);
    this.playerFlightPathDirection = new Phaser.Math.Vector2(1, 0);
    this.cameraFlightPathAngle = 0.0;
    this.squads = [];

    this.uiScene = null;

};
Gameplay.prototype.init = function () {
    this.renderer = new THREE.WebGLRenderer( { canvas: this.game.canvas, context: this.game.context, antialias: false, powerPreference: 'low-power' } );
    this.renderer.autoClear = false;

    this.keyboard = this.input.keyboard;
    this.keys.rightArrow = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keys.leftArrow = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keys.downArrow = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keys.upArrow = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keys.rightAimArrow = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.keys.leftAimArrow = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.keys.downAimArrow = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.keys.upAimArrow = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keys.aKey = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keys.bKey = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.keys.cKey = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);
    this.keys.rKey = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.keys.lKey = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.events.on('shutdown', this.shutdown, this);
};
Gameplay.prototype.preload = function () {
    this.load.spritesheet('test_sheet', 'asset/image/fromJesse.png', { frameWidth: 32, frameHeight: 32 });
    this.load.image('test_sheet_image', 'asset/image/fromJesse.png');

    this.load.glsl('film_grain', 'asset/shader/film_grain.frag');

    this.load.json('formations', 'asset/formation/formations.json');

    this.load.binary('test_robot', 'asset/model/test_robot.glb');
    this.load.binary('basic_enemy', 'asset/model/basic_enemy.glb');
    this.load.binary('explosion', 'asset/model/explosion.glb');

    this.load.image('test_map_1', 'asset/map_topology/test_map_1.png');
};
Gameplay.prototype.setupThreeBackground = function () {
    this.three = this.add.extern(); 
    let that = this;
    let threeRenderer = this.renderer;
    let threeScene = this.threeScene;
    let threeCam = this.camera;
    this.three.render = function (prenderer, pcamera, pcalcMatrix) {
        that.updateThreeScene();

        threeRenderer.state.reset();
        threeRenderer.sortObjects = true;
        threeRenderer.render(threeScene, threeCam);
    };
};
Gameplay.prototype.initializeThreeScene = function () {
    this.decorMeshes = [];

    const loader = new THREE.GLTFLoader();
    let loadAndAppendModel = (root, modelName) => {
        const robotModelData = this.cache.binary.get(modelName);
        loader.parse(robotModelData, 'asset/model/', (gltfData) => {
            root.add(gltfData.scene);
            if (gltfData.animations.length > 0) {
                let mixer = new THREE.AnimationMixer(gltfData.scene);
                this.mixers.push(mixer);
                root.animData = {};

                let skeletonData = new THREE.SkeletonHelper(gltfData.scene);
                root.boneData = skeletonData.bones;

                gltfData.animations.forEach((anim) => {
                    const action = mixer.clipAction(anim);
                    root.animData[anim.name] = action;

                    if (anim.name === 'idle') {
                        action.play();
                    } else {
                        action.loop = THREE.LoopOnce;
                    }
                });
            }
        });
    };

    // standard ambient lighting for principled BSDFs
    let l = new THREE.AmbientLight(0xFFFFFF);
    this.threeScene.add(l);

    let fieldGeom = new THREE.PlaneBufferGeometry( GAME_WIDTH, GAME_HEIGHT, 1, 1 );
    let fieldMat = new THREE.MeshBasicMaterial( { color: 0xFF00FF } );
    fieldMat.wireframe = true;
    let fieldMesh = new THREE.Mesh( fieldGeom, fieldMat );
    fieldMesh.position.set(GAME_WIDTH * 0.5, 0, GAME_HEIGHT * 0.5);
    fieldMesh.rotation.x = Math.PI * -0.5;
    this.threeScene.add(fieldMesh);

    let playerMesh = new THREE.Group();
    loadAndAppendModel(playerMesh, 'test_robot');
    this.threeScene.add(playerMesh);
    this.sceneMeshData['player'] = playerMesh;

    let basicSwordGeom = new THREE.BoxBufferGeometry(8, 64, 8);
    let basicSwordMat = new THREE.MeshBasicMaterial( { color: 0xFFFFFF , wireframe: true} );
    let swordColors = [0x0000FF, 0xFFFFFF, 0x0000FF, 0xFFFFFF].map((col) => { return new THREE.Color(col); });
    let swordColorsIndex = 0;
    this.time.addEvent({ delay: 16, callback: () => {
        swordColorsIndex = (swordColorsIndex + 1) % swordColors.length;
        basicSwordMat.color = swordColors[swordColorsIndex];
    }, callbackScope: this, loop: true });
    let basicSwordMesh = new THREE.Mesh(basicSwordGeom, basicSwordMat);
    this.sceneMeshData['sword'] = basicSwordMesh;

    let c = new THREE.Color(0x1111CC);
    let cTo = new THREE.Color(0xFFFFFF);
    let trails = [];
    const trailPieces = 10;
    for (var i = 0; i < trailPieces; i++) {
        let trailMesh = new THREE.Mesh(basicSwordGeom, new THREE.MeshBasicMaterial( { color: c.getHex() } ));
        c.lerp(cTo, 0.35);
        this.threeScene.add(trailMesh);
        trails.push(trailMesh);
    }
    this.time.addEvent({delay: 16, loop: true, callback: () => {
        for (let i = (trails.length - 1); i >= 0; i--) {
            let piece = trails[i];
            if (i === 0) {
                basicSwordMesh.getWorldPosition(piece.position);
                basicSwordMesh.getWorldQuaternion(piece.quaternion);
                piece.visible = basicSwordMesh.visible;
                continue;
            }
            let prevPiece = trails[i - 1];
            piece.position.x = prevPiece.position.x;
            piece.position.y = prevPiece.position.y;
            piece.position.z = prevPiece.position.z;
            piece.rotation.x = prevPiece.rotation.x;
            piece.rotation.y = prevPiece.rotation.y;
            piece.rotation.z = prevPiece.rotation.z;
            piece.visible = prevPiece.visible;
            piece.scale.set(1 - (i / trailPieces), 1 - (i / trailPieces), 1 - (i / trailPieces));
        }
    }});
    
    this.enemyMeshPool['basic'] = [];
    for (var i = 1; i < ENEMY_POOL_SIZE; i++) {
        let c = new THREE.Group();
        loadAndAppendModel(c, 'basic_enemy');
        this.enemyMeshPool['basic'].push(c);
        this.threeScene.add(c);
        c.visible = false;
    }

    let basicBulletGeom = new THREE.BoxBufferGeometry(8, 8, 8);
    let basicBulletMat = new THREE.MeshBasicMaterial( { color: 0x88FF88 } );
    let basicEnemyBulletMat = new THREE.MeshBasicMaterial( { color: 0xcccc00 } );
    let basicBulletMesh = new THREE.Mesh(basicBulletGeom, basicBulletMat);
    basicBulletMesh.scale.z = 2.3;
    this.bulletMeshPool['bullet'] = [];
    for (var i = 0; i < PLAYER_BULLET_POOL_SIZE; i++) {
        let c = basicBulletMesh.clone();
        this.bulletMeshPool['bullet'].push(c);
        this.threeScene.add(c);
        c.visible = false;
    }

    let basicEnemyBulletMesh = new THREE.Mesh(basicBulletGeom, basicEnemyBulletMat);
    this.bulletMeshPool['enemy'] = [];
    for (var i = 0; i < PLAYER_BULLET_POOL_SIZE; i++) {
        let c = basicEnemyBulletMesh.clone();
        this.bulletMeshPool['enemy'].push(c);
        this.threeScene.add(c);
        c.visible = false;
    }

    this.explosionMeshPool = [];
    for (var i = 0; i < EXPLOSION_POOL_SIZE; i++) {
        let explosion = new THREE.Group();
        explosion.flyAngle = 0;
        loadAndAppendModel(explosion, 'explosion');
        this.threeScene.add(explosion);
        this.explosionMeshPool.push(explosion);
        this.decorMeshes.push(explosion);
    }
    this.explosionIndex = 0;

    this.vapourTrailPool = [];
    let vapourGeom = new THREE.TetrahedronBufferGeometry(2.0, 1);
    let vapourMats = [new THREE.MeshBasicMaterial({ color: 0xe6e4d1 }), new THREE.MeshBasicMaterial({ color: 0xbfbeb0 }),new THREE.MeshBasicMaterial({color: 0xccc9a5})];
    for (var i = 0; i < 64; i++) {
        let vaporMesh = new THREE.Mesh(vapourGeom, vapourMats[i % vapourMats.length]);
        vaporMesh.flyAngle = 0;
        this.vapourTrailPool.push(vaporMesh);
        this.decorMeshes.push(vaporMesh);
        this.threeScene.add(vaporMesh);
    }
    this.vaporIndex = 0;

    let sceneryVertShader = `
    precision mediump float;

    uniform vec2 flyOffset;
    uniform float flyAngle;
    uniform sampler2D mapData;
    uniform vec2 worldScale;

    const float PI = 3.1415926535897932384626433832795;
    const float PI_2 = 1.57079632679489661923;
    const float PI_4 = 0.785398163397448309616;

    const vec3 sunshineRay = normalize(vec3(2.0, -1.0, 0.75));

    vec2 rotate(vec2 v, float a) {
        float s = sin(a);
        float c = cos(a);
        mat2 m = mat2(c, -s, s, c);
        return m * v;
    }
    
    float rand(float n){return fract(sin(n) * 43758.5453123);}

    float noise(float p){
        float fl = floor(p);
        float fc = fract(p);
        return mix(rand(fl), rand(fl + 1.0), fc);
    }

    float rand(vec2 n) { 
        return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
    }

    float noise(vec2 p){
        vec2 ip = floor(p);
        vec2 u = fract(p);
        u = u*u*(3.0-2.0*u);

        float res = mix(
        mix(rand(ip),rand(ip+vec2(1.0,0.0)),u.x),
        mix(rand(ip+vec2(0.0,1.0)),rand(ip+vec2(1.0,1.0)),u.x),u.y);
        return res*res;
    }

    vec3 rgb2hsv(vec3 c)
    {
        vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
        vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

        float d = q.x - min(q.w, q.y);
        float e = 1.0e-10;
        return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
    }

    varying float noiseVal;
    varying float waterHeight;

    varying vec2 positionInWorld;
    varying float vertexLambert;

    float sampleRandomWorldAt(vec2 pos) {
        float scale = 0.035;

        return noise(rotate(pos, PI_4) * scale);
    }

    float sampleMapDataAt(vec2 pos) {
        vec4 col = texture2D(mapData, pos / 1024.0);
        vec3 colHsv = rgb2hsv(col.xyz);
        return colHsv.z;
    }

    void main() {
        float heightVal = 256.0;
        waterHeight = 0.2;

        vec4 modelPos = vec4( position, 1.0 );
        positionInWorld = flyOffset + rotate(modelPos.xy * worldScale, flyAngle + PI_2);
        noiseVal = sampleMapDataAt(positionInWorld);
        float scaledNoise = max((noiseVal * heightVal), waterHeight * heightVal);

        vec4 posCandidate =  projectionMatrix * modelViewMatrix * modelPos;
        gl_Position = vec4(posCandidate.x, posCandidate.y + scaledNoise, posCandidate.z, posCandidate.w);


        float noiseDetla = 0.1;
        vec3 noisePos = vec3(positionInWorld.x, noiseVal * 2.0, positionInWorld.y);
        vec3 xOffsetPos = noisePos + vec3(noiseDetla, 0.0, 0.0);
        vec3 yOffsetPos = noisePos + vec3(0.0, 0.0, noiseDetla);
        xOffsetPos.y = sampleMapDataAt(xOffsetPos.xz) * 2.0;
        yOffsetPos.y = sampleMapDataAt(yOffsetPos.xz) * 2.0;
        vec3 xGrad = xOffsetPos - noisePos;
        vec3 yGrad = yOffsetPos - noisePos;
        vec3 positionNormal = normalize(cross(yGrad, xGrad));

        float lambertDotProduct = dot(sunshineRay, positionNormal);
        vertexLambert = max(0.045, lambertDotProduct) * 1.14;
    }
    `;
    let sceneryFragShader = `
    precision mediump float;
    
    varying float noiseVal;
    varying float waterHeight;

    varying float vertexLambert;

    uniform vec2 flyOffset;
    uniform sampler2D mapData;

    varying vec2 positionInWorld;

    float rand(float n){return fract(sin(n) * 17858.5453123);}

    float noise(float p){
    float fl = floor(p);
        float fc = fract(p);
        return mix(rand(fl), rand(fl + 1.0), fc);
    }

    float rand(vec2 n) { 
        return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
    }

    float noise(vec2 p){
        vec2 ip = floor(p);
        vec2 u = fract(p);
        u = u*u*(3.0-2.0*u);

        float res = mix(
        mix(rand(ip),rand(ip+vec2(1.0,0.0)),u.x),
        mix(rand(ip+vec2(0.0,1.0)),rand(ip+vec2(1.0,1.0)),u.x),u.y);
        return res*res;
    }

    void main() {
        vec4 landColor = vec4(0.25, 0.23, 0.105, 1.0);
        vec4 landColor2 = vec4(0.74, 0.7, 0.35, 1.0);
        vec4 landColor3 = vec4(0.25, 0.507, 0.129, 1.0);
        vec4 landColor4 = vec4(0.16, 0.321, 0.08, 1.0);
        vec4 seaColor = vec4(0.23, 0.41, 0.45, 1.0);
        vec4 seaColor2 = vec4(0.27 * 0.5, 0.68 * 0.5, 0.74 * 0.5, 1.0);

        
        float val = noise(positionInWorld * 1.0);
        if ((noiseVal) > (waterHeight + 0.2)) {
            gl_FragColor = (val * landColor3) + ((1.0 - val) * landColor4);
        } else if (noiseVal > waterHeight) {
            gl_FragColor = (val * landColor) + ((1.0 - val) * landColor2);
        } else {
            gl_FragColor = (val * seaColor) + ((1.0 - val) * seaColor2);
        }

        gl_FragColor -= vec4(vertexLambert, vertexLambert, vertexLambert, 0.0) * 0.4;
    }
    `;
    let mapThreeTexture = new THREE.TextureLoader().load( "asset/map_topology/test_map_1.png");
    let floorPlane = new THREE.PlaneBufferGeometry(1200, 1100, 500, 500);
    let floorMat = new THREE.ShaderMaterial( { uniforms: { mapData: { value: mapThreeTexture }, flyAngle: { value: 0 }, flyOffset: { value: new THREE.Vector2() }, worldScale: { value: new THREE.Vector2(SHADER_WORLD_SCALE, SHADER_WORLD_SCALE) }}, vertexShader: sceneryVertShader, fragmentShader: sceneryFragShader } );
    //floorMat.fog = true;
    let floor = new THREE.Mesh(floorPlane, floorMat);
    floor.rotation.x = Math.PI * -0.5;
    floor.position.set(GAME_WIDTH * 0.5, -125, GAME_HEIGHT * 0.5 - 100);
    this.threeScene.add(floor);
    this.groundBackdrop = floor;
    this.groundMat = floorMat;
};

Gameplay.prototype.updateThreeScene = function () {
    this.sceneMeshData['player'].position.set(this.player.x, 0, this.player.y);
    this.sceneMeshData['player'].rotation.set(0, Math.PI, 0);

    const cameraYDist = 300;
    const cameraZDist = 200;

    this.camera.position.set(GAME_WIDTH * 0.5 + ((this.player.x / GAME_WIDTH) * (GAME_WIDTH * 0.3) - (GAME_WIDTH * 0.15)), cameraYDist, GAME_HEIGHT * 0.5 + cameraZDist + ((this.player.y / GAME_HEIGHT) * (GAME_HEIGHT * 0.3) - (GAME_HEIGHT * 0.15)));
    this.camera.lookAt(GAME_WIDTH * 0.5 + ((this.player.x / GAME_WIDTH) * (GAME_WIDTH * 0.3) - (GAME_WIDTH * 0.15)), 0, GAME_HEIGHT * 0.5 + ((this.player.y / GAME_HEIGHT) * (GAME_HEIGHT * 0.3) - (GAME_HEIGHT * 0.15)));

    this.groundMat.uniforms.flyOffset.value.x = this.playerPosition.x;
    this.groundMat.uniforms.flyOffset.value.y = this.playerPosition.y;

    // This looks odd, but phaser's positive Y axis is in a different direction than three.js
    this.groundMat.uniforms.flyAngle.value = Math.atan2(Math.sin(this.cameraFlightPathAngle) * -1, Math.cos(this.cameraFlightPathAngle));

    // make explosions/vapour/etc. look like they're moving
    for (let i = 0; i < this.decorMeshes.length; i++) {
        const sixtyFramesPerSecond = 0.016;

        let mesh = this.decorMeshes[i];
        mesh.position.x -= (Math.cos(mesh.flyAngle - this.cameraFlightPathAngle + (Math.PI * 0.5))) * 300.0 * sixtyFramesPerSecond;
        mesh.position.z += (Math.sin(mesh.flyAngle - this.cameraFlightPathAngle + (Math.PI * 0.5))) * 300.0 * sixtyFramesPerSecond;
    }

    let nextVapor = this.vapourTrailPool[this.vaporIndex];
    this.vaporIndex = (this.vaporIndex + 1) % this.vapourTrailPool.length;
    nextVapor.rotation.set(Math.random(), Math.random(), Math.random());
    const vapeScale = 2.0 * (Math.random() * 2.0);
    nextVapor.scale.set(vapeScale, vapeScale, vapeScale);
    nextVapor.position.set(this.player.x + ((Math.random() < 0.5) ? -8 : 8), 0, this.player.y + (5 - Math.random() * 5));
    nextVapor.flyAngle = this.playerFlightPathDirection.angle();
};
Gameplay.prototype.triggerExplosion = function (x, y, z, scale, duration) {
    scale = scale ? scale : 1.0;
    duration = duration ? duration : 1.0;

    let nextExplosion = this.explosionMeshPool[this.explosionIndex];
    this.explosionIndex = (this.explosionIndex + 1) % this.explosionMeshPool.length;
    nextExplosion.flyAngle = this.playerFlightPathDirection.angle();

    if (nextExplosion.animData === undefined) {
        return;
    }

    nextExplosion.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
    nextExplosion.position.set(x, y, z);
    nextExplosion.scale.set(scale, scale, scale);
    const anim = nextExplosion.animData['explode'];
    anim.setDuration(duration);
    anim.reset();
    anim.play();
}
Gameplay.prototype.setupEvents = function () {
};
Gameplay.prototype.removeEvents = function () {
};
Gameplay.prototype.updateFlightPath = function (newDir) {
    if (this.isTurning === true) {
        return;
    }

    this.playerFlightPathDirection.x = newDir.x;
    this.playerFlightPathDirection.y = newDir.y;
    this.playerFlightPathDirection.normalize();

    this.isTurning = true;

    const currentAngle = this.cameraFlightPathAngle;
    const targetAngle = this.playerFlightPathDirection.angle();
    const minimumDistance = ((targetAngle - currentAngle) + Math.PI) % (Math.PI * 2) - Math.PI;
    let t = this.add.tween({
        targets: this,
        duration: 2000,
        cameraFlightPathAngle: (currentAngle + minimumDistance),
        ease: Phaser.Math.Easing.Cubic.Out,
        easeParams: [0.0001, 1.0],
        onComplete: () => {
            this.isTurning = false;
        }
    });
};
Gameplay.prototype.getFlightPath = function() {
    return this.playerFlightPathDirection;
}

Gameplay.prototype.initializePlayer = function () {
    this.playerPosition = new Phaser.Math.Vector2(this.worldSize.x * 0.5, this.worldSize.y * 0.5);

    this.player = this.add.sprite(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.75, 'test_sheet', 0);
    this.playerHealth = PLAYER_MAX_HEALTH;
    this.player.setVisible(false);
    this.canShoot = true;
    this.physics.add.existing(this.player);
    this.player.body.setSize(8, 8, true);
    this.player.dodging = false;
    this.player.canDodge = true;
    this.player.striking = false;
    this.player.canStrike = true;
    this.time.addEvent({ delay: PLAYER_SHOT_DELAY_MS, callback: () => { this.canShoot = true; }, callbackScope: this, loop: true });

    this.swordHits = [];
    for (var i = 0; i < PLAYER_SWORD_SEGMENTS; i++) {
        let newSwordPiece = this.add.sprite(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, 'test_sheet', 0);
        newSwordPiece.setVisible(false);
        this.physics.add.existing(newSwordPiece);
        newSwordPiece.body.setSize(8, PLAYER_SWORD_LENGTH / PLAYER_SWORD_SEGMENTS, true);
        newSwordPiece.x = -19999;
        newSwordPiece.y = -999999;
        newSwordPiece.moves = true;
        this.swordHits.push(newSwordPiece);
    }
};
Gameplay.prototype.initializeEnemies = function() {
    this.enemies = this.add.group();
    for (var i = 0; i < ENEMY_POOL_SIZE; i++) {
        let enemy = this.add.sprite(-9999, -99999, 'test_sheet', 13);
        this.physics.add.existing(enemy);
        enemy.body.moves = false;
        enemy.tint = 0xFF6666;
        enemy.visible = false;
        enemy.name = BULLET_NAME_KEY;
        enemy.timeToTextBullet = ENEMY_BULLET_PERIOD_MS;
        enemy.path = null;
        enemy.startOffset = new Phaser.Math.Vector2(0, 0);
        enemy.pathPos = 0;
        enemy.entering = false;
        enemy.squadIndex = -1;
        enemy.shipIndex = -1;
        enemy.mesh = null;
        this.enemies.add(enemy);
        this.enemies.killAndHide(enemy);
    }
};

Gameplay.prototype.deployFormation = function(formationKey, deployDelay, squadIndex) {
    const formation = this.formationData[formationKey];
    if (formation === undefined) {
        console.warn('Could not find/deploy ' + formationKey + ' does it exist?');
        return;
    }

    const squad = this.squads[squadIndex];
    const healthInfo = this.squads[squadIndex].health_data;

    deployDelay = (deployDelay === undefined) ? 0 : deployDelay;
    for (let i = 0; i < formation.ships.length; i++) {
        if (healthInfo[i] <= 0) {
            continue;
        }

        this.time.addEvent({ delay: (deployDelay + (i * formation.deploy_rate)), callback: () => {
            const shipType = formation.ships[i];
            // TODO: Depends on ship type

            let newEnemy = this.enemies.getFirstDead();
            if (newEnemy === null) {
                console.warn('Unable to get an enemy! Is the pool too small?');
                return;
            }
            newEnemy.x = formation.path[0];
            newEnemy.y = formation.path[1];
            newEnemy.setActive(true);
            //newEnemy.setVisible(true);
            newEnemy.path = formation.curve;
            newEnemy.pathPos = 0;
            newEnemy.startOffset.x = formation.offset_per_deploy.x * i;
            newEnemy.startOffset.y = formation.offset_per_deploy.y * i;
            newEnemy.entering = true;
            newEnemy.shipIndex = i;
            newEnemy.squadIndex = squadIndex;
            newEnemy.type = shipType;
            if (this.enemyMeshPool[shipType].length > 0) {
                newEnemy.mesh = this.enemyMeshPool[shipType].pop();
                newEnemy.mesh.visible = true;
            }
            squad.onscreen_ships++;
        }, loop: false });
    };

};
Gameplay.prototype.initialzeBullets = function () {
    this.playerBullets = this.add.group();
    for (var i = 0; i < PLAYER_BULLET_POOL_SIZE; i++) {
        let bullet = this.add.sprite(-9999, -99999, 'test_sheet', 21);
        bullet.setScale(0.25);
        bullet.name = BULLET_NAME_KEY;
        this.physics.add.existing(bullet);
        bullet.body.setSize(32, 32, true);
        this.playerBullets.add(bullet);
        this.playerBullets.killAndHide(bullet);
        bullet.mesh = this.bulletMeshPool[bullet.name][i];
        bullet.visible = false;
    }

    this.enemyBullets = this.add.group();
    for (var i = 0; i < PLAYER_BULLET_POOL_SIZE; i++) {
        let bullet = this.add.sprite(-9999, -99999, 'test_sheet', 21);
        bullet.setScale(0.25);
        bullet.name = ENEMY_NAME_KEY;
        bullet.tint = 0x0033FF;
        this.physics.add.existing(bullet);
        bullet.body.setSize(32, 32, true);
        this.enemyBullets.add(bullet);
        this.enemyBullets.killAndHide(bullet);
        bullet.mesh = this.bulletMeshPool[bullet.name][i];
        bullet.visible = false;
    }
};
Gameplay.prototype.initializeCollisions = function () {
    this.physics.add.overlap(this.playerBullets, this.enemies, (bullet, enemy) => {
        const squad = this.squads[enemy.squadIndex];
        this.triggerExplosion(enemy.x, 0, enemy.y, 0.73535, 0.45);
        if (squad === null) {
            this.enemies.killAndHide(enemy);
            this.enemyMeshPool[enemy.type].push(enemy.mesh);
            enemy.mesh.visible = false;
            enemy.mesh = null;
            enemy.x = -99999;
            enemy.y = -99999;
            return;
        }
        squad.health_data[enemy.shipIndex] -= BULLET_DAMAGE;

        if (squad.health_data[enemy.shipIndex] <= 0) {

            squad.onscreen_ships--;
            this.enemies.killAndHide(enemy);
            this.enemyMeshPool[enemy.type].push(enemy.mesh);
            enemy.mesh.visible = false;
            enemy.mesh = null;
            enemy.x = -99999;
            enemy.y = -99999;
        }

        this.playerBullets.killAndHide(bullet);
        bullet.x = -9999;
        bullet.y = -9999;
    }, (bullet, enemy) => { return enemy.active; });

    this.physics.add.overlap(this.swordHits, this.enemies, (sword, enemy) => {
        const squad = this.squads[enemy.squadIndex];
        this.triggerExplosion(enemy.x, 0, enemy.y, 0.73535, 0.45);

        if (squad === null) {
            this.triggerExplosion(enemy.x, 0, enemy.y, 0.487535, 0.45);
            this.enemies.killAndHide(enemy);
            this.enemyMeshPool[enemy.type].push(enemy.mesh);
            enemy.mesh.visible = false;
            enemy.mesh = null;
            enemy.x = -99999;
            enemy.y = -99999;
            return;
        }
        squad.health_data[enemy.shipIndex] = 0;

        if (squad.health_data[enemy.shipIndex] <= 0) {
            squad.onscreen_ships--;
            this.enemies.killAndHide(enemy);
            this.enemyMeshPool[enemy.type].push(enemy.mesh);
            enemy.mesh.visible = false;
            enemy.mesh = null;
            enemy.x = -99999;
            enemy.y = -99999;
        }
    }, (sword, enemy) => { return enemy.active; });

    this.physics.add.overlap(this.swordHits, this.enemyBullets, (sword, enemyBullet) => {
            this.enemyBullets.killAndHide(enemyBullet);
            enemyBullet.x = -99999;
            enemyBullet.y = -99999;
    }, (sword, enemyBullet) => { return enemyBullet.active; });

    this.physics.add.overlap(this.player, this.enemyBullets, (player, enemyBullet) => {
        this.enemyBullets.killAndHide(enemyBullet);
        enemyBullet.x = -99999;
        enemyBullet.y = -99999;

        this.playerHealth -= ENEMY_BULLET_DAMAGE;
        if (this.playerHealth <= 0) {
            this.player.setActive(false);
            this.sceneMeshData['player'].visible = false;
        }

        this.uiScene.refreshUI(this.playerHealth, this.score);
    }, (player, enemyBullet) => { return (this.player.dodging == false); });

    this.physics.add.overlap(this.player, this.enemies, (player, enemy) => {
        const squad = this.squads[enemy.squadIndex];
        if (squad === null) {
            return;
        }


        this.triggerExplosion(enemy.x, 0, enemy.y, 0.487535, 0.45);
        squad.health_data[enemy.shipIndex] = 0;
        squad.onscreen_ships--;
        this.enemies.killAndHide(enemy);
        this.enemyMeshPool[enemy.type].push(enemy.mesh);
        enemy.mesh.visible = false;
        enemy.mesh = null;
        enemy.x = -99999;
        enemy.y = -99999;

        this.playerHealth -= ENEMY_COLLIDE_DAMAGE;
        if (this.playerHealth <= 0) {
            this.player.setActive(false);
            this.sceneMeshData['player'].visible = false;
        }

        this.uiScene.refreshUI(this.playerHealth, this.score);
    }, (player, enemy) => { return (this.player.dodging == false); });
};

Gameplay.prototype.create = function () {
    this.uiScene = this.scene.get('InGameUI');
    this.setupEvents();

    this.setupThreeBackground();
    this.initializeThreeScene();

    this.score = 0;
    this.squads = [];

    this.formationData = {};
    let formData = this.cache.json.get('formations');
    for (let formationKey in formData) {
        let formation = formData[formationKey];
        if (formation.path === undefined) {
            console.warn('bad formation path data for ' + formationKey);
            continue;
        }
        if (formation.path.length < 2) {
            console.warn('formation path data ' + formationKey + ' is too short!');
            continue;
        }
        let newPath = new Phaser.Curves.Path(formation.path[0], formation.path[1]);
        for (let i = 2; i < formation.path.length; i += 2) {
            newPath.lineTo(formation.path[i], formation.path[i + 1]);
        };
        formation.curve = newPath;
        this.formationData[formationKey] = formation;
    } 


    /*
    // TODO: editor data should look like this
    this.squads = [
        {
            "formation": "sample_a",
            "x": 0.25 * this.worldSize.x,
            "y": 0.25 * this.worldSize.y,
            "in_battle": false
        },
        {
            "formation": "sample_a",
            "x": 0.25 * this.worldSize.x,
            "y": 0.75 * this.worldSize.y,
            "in_battle": false
        },
        {
            "formation": "sample_c",
            "x": 0.55 * this.worldSize.x,
            "y": 0.35 * this.worldSize.y,
            "in_battle": false
        },
        {
            "formation": "sample_a",
            "x": 0.75 * this.worldSize.x,
            "y": 0.75 * this.worldSize.y,
            "in_battle": false
        }
    ];
    */

    // some dummy squads
    for (let i = 0; i < 100; i++) {
        const minR = 100;
        const extraR = Math.random() * 400;
        const dir = Math.random() * Math.PI * 2;
        this.squads.push({
            formation: ['sample_a', 'sample_b', 'sample_c', 'sample_d'][~~(Math.random() * 4)],
            in_battle: false,
            x: (this.worldSize.x * 0.5) + Math.cos(dir) * (minR + extraR),
            y: (this.worldSize.y * 0.5) + Math.sin(dir) * (minR + extraR)
        });
    }


    this.squads.forEach((squad) => {
        this.initializeSquadData(squad);
    })

    this.initializePlayer();
    this.initializeEnemies();
    this.initialzeBullets();
    this.initializeCollisions();
    
    let sceneShader = this.add.shader('film_grain', GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, GAME_WIDTH, GAME_HEIGHT);
};

Gameplay.prototype.initializeSquadData = function(squad) {
    squad.health_data = [];
    const formation = this.formationData[squad.formation];
    formation.ships.forEach((ship) => {
        // TODO: per-ship health
        const shipHealth = ENEMY_MAX_HEALTH;
        squad.health_data.push(shipHealth);
    });
    squad.onscreen_ships = 0;
}

let pathPointCache = new Phaser.Math.Vector2(0, 0);

let squadPointCache = new Phaser.Math.Vector2(0, 0);
Gameplay.prototype.updateWorld = function () {
    const sixtyFramesPerSecond = 0.016;

    this.playerPosition.x += this.playerFlightPathDirection.x * sixtyFramesPerSecond * PLAYER_FLIGHT_SPEED;
    this.playerPosition.y += this.playerFlightPathDirection.y * sixtyFramesPerSecond * PLAYER_FLIGHT_SPEED;
    this.uiScene.refreshMap(this.worldSize, this.playerPosition, this.squads);

    // If we've left the world bounds, turn around
    if ((this.playerPosition.x < 0) || (this.playerPosition.x > this.worldSize.x)) {
        this.playerPosition.x = Phaser.Math.Clamp(this.playerPosition.x, 0, this.worldSize.x);
        this.updateFlightPath( {x: (this.playerFlightPathDirection.x * -1), y: this.playerFlightPathDirection.y} );
    }
    if ((this.playerPosition.y < 0) || (this.playerPosition.y > this.worldSize.y)) {
        this.playerPosition.y = Phaser.Math.Clamp(this.playerPosition.y, 0, this.worldSize.y);
        this.updateFlightPath( {x: this.playerFlightPathDirection.x, y: (this.playerFlightPathDirection.y * -1)} );
    }

    // TODO: Spatial sorting of squads for faster distance-checking

    this.squads.forEach((squad, index) => {
        if (squad === null) {
            return;
        }

        squadPointCache.x = squad.x;
        squadPointCache.y = squad.y;

        // If all enemies are done, then this squad is effectively destroyed
        let healthSum = 0;
        squad.health_data.forEach((val) => {
            healthSum += val;
        });
        if (healthSum <= 0.0000001) {
            this.squads[index] = null;
            return;
        }

        // We can never be in battle if we're too far away
        if ((squad.in_battle === false) && (this.playerPosition.distanceSq(squadPointCache) > ENTRY_INTO_BATTLE_DISTANCE_SQ)) {
            return;
        }

        // If we're too far away and there are no onscreen ships, then we're not in battle anymore
        if ((squad.in_battle === true) && ((this.playerPosition.distanceSq(squadPointCache) > ENTRY_INTO_BATTLE_DISTANCE_SQ) || (squad.onscreen_ships < 1))) {
            squad.x = this.playerPosition.x + -(this.playerFlightPathDirection.x * (ENTRY_INTO_BATTLE_DISTANCE + 5));
            squad.y = this.playerPosition.y + -(this.playerFlightPathDirection.y * (ENTRY_INTO_BATTLE_DISTANCE + 5));

            squad.in_battle = false;
            return;
        }

        // If we're already in battle, update position instead
        if (squad.in_battle === true) {
            squad.x = this.playerPosition.x;
            squad.y = this.playerPosition.y;
            return;
        }

        squad.in_battle = true;
        this.deployFormation(squad.formation, 0, index);
    });
};

Gameplay.prototype.update = function () {
    let spawnBullet = () => {
        let newBullet = this.playerBullets.getFirstDead();
        if (newBullet === null) {
            console.warn('Unable to get a bullet? Is the pool too small?');
            return;
        }
        newBullet.x = this.player.x;
        newBullet.y = this.player.y;
        newBullet.setActive(true);
        newBullet.body.velocity.x = this.playerAimDir.x * PLAYER_BULLET_SPEED;
        newBullet.body.velocity.y = this.playerAimDir.y * PLAYER_BULLET_SPEED;
    };

    let updateInput = () => {
        if (this.player.active === false) {
            this.player.body.velocity.x = 0;
            this.player.body.velocity.y = 0;
            return;
        }

        const moveSpeed = this.player.dodging ? PLAYER_DODGE_SPEED : PLAYER_MOVE_SPEED;

        // movement
        if (this.keys.rightArrow.isDown) {
            this.player.body.velocity.x = moveSpeed;
        } else if (this.keys.leftArrow.isDown) {
            this.player.body.velocity.x = -moveSpeed;
        } else {
            this.player.body.velocity.x = 0;
        }
        if (this.keys.downArrow.isDown) {
            this.player.body.velocity.y = moveSpeed;
        } else if (this.keys.upArrow.isDown) {
            this.player.body.velocity.y = -moveSpeed;
        } else {
            this.player.body.velocity.y = 0;
        }
        if (this.input.gamepad && (this.input.gamepad.total > 0)) {
            var pad = this.input.gamepad.getPad(0);

            if (pad.leftStick.lengthSq() > 0.1) {
              this.player.body.velocity.x = pad.leftStick.x * moveSpeed;
              this.player.body.velocity.y = pad.leftStick.y * moveSpeed;
            } else {
                if (pad.right) {
                    this.player.body.velocity.x = moveSpeed;
                } else if (pad.left) {
                    this.player.body.velocity.x = -moveSpeed;
                } else {
                    this.player.body.velocity.x = 0;
                }
                if (pad.down) {
                    this.player.body.velocity.y = moveSpeed;
                } else if (pad.up) {
                    this.player.body.velocity.y = -moveSpeed;
                } else {
                    this.player.body.velocity.y = 0;
                }
            }
        }

        this.playerAimDir.normalize();

        // shooting
        if ((this.canShoot === true) && (this.player.dodging === false)) {
            let shoot = () => {
                spawnBullet();
                this.canShoot = false;
            };
            if (this.input.gamepad && (this.input.gamepad.total > 0) && (this.input.gamepad.getPad(0).B || this.input.gamepad.getPad(0).R1)) {
                shoot();
            } else if (this.keys.aKey.isDown) {
                shoot();
            }
        }

        if ((this.player.dodging === false) && (this.player.canDodge === true) && (this.player.striking === false)) {
            let dodge = () => {
                this.player.dodging = true;
                this.player.canDodge = false;

                this.time.delayedCall(PLAYER_DODGE_TIME_MS, () => {
                    this.player.dodging = false;
                });
                this.time.delayedCall(PLAYER_DODGE_RECHARGE_TIME_MS, () => {
                    this.player.canDodge = true;
                });
            };
            if (this.input.gamepad && (this.input.gamepad.total > 0) && (this.input.gamepad.getPad(0).A || this.input.gamepad.getPad(0).L1)) {
                dodge();
            } else if (this.keys.bKey.isDown) {
                dodge();
            }
        }

        if ((this.player.striking === false) && (this.player.canStrike === true) && (this.player.dodging === false)) {
            let strike = () => {
                this.player.striking = true;
                this.player.canStrike = false;
                this.player.canDodge = false;

                this.time.delayedCall(PLAYER_DODGE_TIME_MS, () => {
                    this.player.striking = false;
                });
                this.time.delayedCall(PLAYER_DODGE_RECHARGE_TIME_MS, () => {
                    this.player.canStrike = true;
                });

                let sword = this.sceneMeshData['sword'];
                sword.position.y = 48;
                sword.visible = true;
                this.sceneMeshData['player'].animData['strike'].setDuration(PLAYER_STRIKE_TIME);
                this.sceneMeshData['player'].animData['idle'].stop();
                this.sceneMeshData['player'].animData['strike'].reset().play();
                this.time.delayedCall(PLAYER_STRIKE_TIME * 1000, () => {
                    this.sceneMeshData['player'].animData['idle'].play();
                    sword.visible = false;
                })

                if (this.sceneMeshData['player'].swordBone === undefined) {
                    this.sceneMeshData['player'].boneData.forEach(function (bone) {
                        if (bone.name === 'SwordHand') {
                            this.sceneMeshData['player'].swordBone = bone;
                        }
                    }, this);
                }
                this.sceneMeshData['player'].swordBone.add(sword);

                for (var i = 0; i < this.swordHits.length; i++) {
                    let piece = this.swordHits[i];
                    piece.x = this.player.x - Math.cos(sword.rotation.y) * (PLAYER_SWORD_LENGTH / PLAYER_SWORD_SEGMENTS * i);
                    piece.y = this.player.y - Math.sin(sword.rotation.y) * (PLAYER_SWORD_LENGTH / PLAYER_SWORD_SEGMENTS * i);
                }
                let comp = () => {
                    for (var i = 0; i < this.swordHits.length; i++) {
                        let piece = this.swordHits[i];
                        piece.x = -19999;
                        piece.y = -19999;
                    }
                };
                let ind = 0;
                this.time.addEvent({
                    repeat: 10,
                    delay: (PLAYER_STRIKE_TIME * 1000 / 10),
                    callback: () => {
                        ind++;
                        for (var i = 0; i < this.swordHits.length; i++) {
                            let piece = this.swordHits[i];
                            piece.x = this.player.x - Math.cos(ind / 10 * Math.PI) * (PLAYER_SWORD_LENGTH / PLAYER_SWORD_SEGMENTS * i);
                            piece.y = this.player.y - Math.sin(ind / 10 * Math.PI) * (PLAYER_SWORD_LENGTH / PLAYER_SWORD_SEGMENTS * i);
                        }

                        if (ind > 10) {
                            comp();
                        }
                    }
                });

            };
            if (this.input.gamepad && (this.input.gamepad.total > 0) && (this.input.gamepad.getPad(0).Y || this.input.gamepad.getPad(0).L2)) {
                strike();
            } else if (this.keys.cKey.isDown) {
                strike();
            }
        }
    };
    updateInput();
    this.player.x = Phaser.Math.Clamp(this.player.x, PLAYER_MOVE_CUTOFF, GAME_WIDTH - PLAYER_MOVE_CUTOFF);
    this.player.y = Phaser.Math.Clamp(this.player.y, PLAYER_MOVE_CUTOFF, GAME_HEIGHT - PLAYER_MOVE_CUTOFF);

    let playerBulletIter = (bullet, i) => {
        bullet.mesh.visible = bullet.active;
        if (bullet.active === false) {
            return;
        }
        bullet.mesh.position.set(bullet.x, 0, bullet.y);
        
        if (this.cameras.cameras[0].worldView.contains(bullet.x, bullet.y) === false) {
            bullet.x = -999999;
            bullet.y = -999999;
            this.playerBullets.killAndHide(bullet);
        }
    };
    let enemyBulletIter = (bullet) => {
        bullet.mesh.visible = bullet.active;
        if (bullet.active === false) {
            return;
        }
        bullet.mesh.position.set(bullet.x, 0, bullet.y);
        
        if (this.cameras.cameras[0].worldView.contains(bullet.x, bullet.y) === false) {
            bullet.x = -999999;
            bullet.y = -999999;
            this.enemyBullets.killAndHide(bullet);
        }
    };
    this.playerBullets.children.iterate(playerBulletIter);
    this.enemyBullets.children.iterate(enemyBulletIter);


    let spawnEnemyBullet = (enemy, angle, velocity) => {
        let newBullet = this.enemyBullets.getFirstDead();
        if (newBullet === null) {
            console.warn('Unable to get an enemy bullet? Is the pool too small?');
            return;
        }
        newBullet.x = enemy.x;
        newBullet.y = enemy.y;
        newBullet.setActive(true);
        newBullet.body.velocity.x = Math.cos(angle) * velocity;
        newBullet.body.velocity.y = Math.sin(angle) * velocity;
    };
    let enemyIter = (enemy) => {
        if (enemy.active === false) {
            return;
        }

        enemy.timeToTextBullet -= 16; // <-- TODO: need real delta
        if (enemy.timeToTextBullet <= 0) {
            enemy.timeToTextBullet = ENEMY_BULLET_PERIOD_MS;
            spawnEnemyBullet(enemy, Math.PI * 0.5, ENEMY_BULLET_SPEED);
        }

        // TODO: de-hack path timing per tick
        const sixtyFramesPerSecond = 0.016;
        const length = enemy.path.getLength();
        const pathVeloRatio = ENEMY_MOVE_SPEED / length * sixtyFramesPerSecond;
        enemy.pathPos += pathVeloRatio;
        enemy.pathPos = Math.min(1, enemy.pathPos);
        enemy.path.getPoint(enemy.pathPos, pathPointCache);
        enemy.x = pathPointCache.x + enemy.startOffset.x;
        enemy.y = pathPointCache.y + enemy.startOffset.y;
        if (enemy.mesh !== null) {
            enemy.mesh.position.set(enemy.x, 0, enemy.y);

            if (enemy.pathPos < 1) {
                const ox = pathPointCache.x;
                const oy = pathPointCache.y;
                enemy.path.getPoint(enemy.pathPos + 0.000001, pathPointCache);
                pathPointCache.x -= ox;
                pathPointCache.y -= oy;
                enemy.mesh.rotation.set(0, -pathPointCache.angle() + (Math.PI * 0.5), 0);
            } else {
                enemy.mesh.rotation.set(0, 0, 0);
            }
        }


        const inWorld = this.cameras.cameras[0].worldView.contains(enemy.x, enemy.y);
        if ((enemy.entering === false) && (inWorld === false)) {
            const squad = this.squads[enemy.squadIndex];
            if (squad !== null) {
                squad.onscreen_ships--;
            }
            enemy.x = -999999;
            enemy.y = -999999;
            this.enemyMeshPool[enemy.type].push(enemy.mesh);
            enemy.mesh.visible = false;
            enemy.mesh = null;
            this.enemies.killAndHide(enemy);
            return;
        }
        if ((inWorld === true) && (enemy.entering === true)) {
            enemy.entering = false;
        }
    };
    this.enemies.children.iterate(enemyIter);

    this.mixers.forEach((mixer) => {
        // TODO: variable timestep this for lower framerates
        const sixtyFramesPerSecond = 0.016;
        mixer.update(sixtyFramesPerSecond);
    })
    this.uiScene.refreshUI(this.playerHealth, this.score);


    this.updateWorld();
    
};
Gameplay.prototype.shutdown = function () {
    this.player = null;
    this.swordHits = [];
    this.playerBullets.clear(true, true);
    this.enemyBullets.clear(true, true);

    this.bulletMeshPool = {};
    this.enemyMeshPool = {};

    while(this.threeScene.children.length > 0){ 
        this.threeScene.remove(this.threeScene.children[0]); 
    }
    this.mixers = [];
};
