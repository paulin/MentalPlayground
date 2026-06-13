# Bikefight RL Simulator Specification (MVP)

## Goal

A one-page JavaScript application where two vehicles fight, and at least one driver learns from repeated matches using Reinforcement Learning (RL).

---

## Version 1 Constraints

Keep the environment intentionally simple:

- 2 vehicles only
- Circular vehicle hitboxes
- Rectangular arena
- No obstacles
- Simple arcade physics
- Fixed vehicle designs initially
- Forward-only Nerf gun
- Discrete action space
- TensorFlow.js DQN implementation

**Do not start with the vehicle designer.** Add vehicle customization after the RL loop is proven to work.

---

# RL Driver

## Observation Vector

```js
[
  selfXNormalized,
  selfYNormalized,
  selfHeadingSin,
  selfHeadingCos,
  selfSpeedNormalized,
  enemyXRelative,
  enemyYRelative,
  enemyDistanceNormalized,
  enemyAngleRelativeSin,
  enemyAngleRelativeCos,
  enemyInFiringCone,
  reloadReady,
  wallDistanceFront,
  wallDistanceLeft,
  wallDistanceRight
]
```

---

## Action Space

Use discrete actions:

```js
[
  "forward",
  "forward_left",
  "forward_right",
  "coast",
  "brake",
  "left",
  "right",
  "fire",
  "forward_fire",
  "forward_left_fire",
  "forward_right_fire"
]
```

Small enough for DQN, expressive enough for combat behavior.

---

# Reward Function

Initial reward design:

```js
reward =
  +25  if hit enemy
  +100 if enemy eliminated
  -25  if hit by enemy
  -100 if eliminated
  -5   if wall collision
  -1   if wasted shot
  +0.2 if enemy is in firing cone
  +0.05 per tick alive
```

Also add:

```js
-0.01 per tick
```

This discourages agents from doing nothing indefinitely.

---

# Training Loop

Each episode:

1. Reset both vehicles.
2. Run simulation for a maximum of 30 seconds.
3. At each simulation tick:
   - Generate observation vector
   - Select action using epsilon-greedy policy
   - Apply action
   - Advance physics and combat systems
   - Calculate reward
   - Store transition in replay buffer
   - Train model from replay buffer
4. End episode when:
   - One vehicle is destroyed, or
   - Time limit is reached

---

# Opponent Strategy

For Version 1, train only a single RL agent.

Opponent should be a scripted bot:

- Turn toward learner
- Move forward when distant
- Fire when learner is in firing cone
- Avoid walls

After the RL agent consistently defeats the scripted bot, introduce self-play.

---

# DQN Architecture

TensorFlow.js network:

```txt
Input Layer: Observation Vector (~15 values)

Dense Layer
- 64 neurons
- ReLU

Dense Layer
- 64 neurons
- ReLU

Output Layer
- Number of actions
```

### Hyperparameters

```txt
Replay Buffer Size: 10,000
Batch Size: 32
Gamma: 0.95
Learning Rate: 0.001

Epsilon Start: 1.0
Epsilon Minimum: 0.05

Target Network Update:
Every 500 steps
```

---

# UI Requirements

The page should contain:

## Arena

- Canvas-based battle arena
- Live vehicle rendering
- Projectile rendering

## Controls

- Start Training
- Pause Training
- Reset Brain
- Run Best Brain
- Speed Controls
  - 1x
  - 10x
  - 50x

## Statistics

- Episode Count
- Win Rate
- Average Reward
- Current Epsilon
- Hits Dealt
- Hits Taken

## Persistence

- Export Brain
- Import Brain

---

# Recommended Build Order

1. Build simulator core without rendering dependency.
2. Create scripted bot vs scripted bot battles.
3. Implement observation generation.
4. Implement action mapping.
5. Implement reward calculation.
6. Implement DQN model.
7. Implement replay buffer.
8. Implement training loop.
9. Add metrics and charts.
10. Add save/load functionality.
11. Add vehicle designer only after RL is working.

---

# Future Expansion

Once the RL system is stable:

## Vehicle Designer

Allow users to configure:

- 2-wheel vehicles
- 3-wheel vehicles
- 4-wheel vehicles
- Wheel placement
- Chassis dimensions
- Weapon placement

## Multi-Agent Battles

- 2–10 vehicles
- Free-for-all
- Team battles

## Arena Features

- Obstacles
- Parking lot layouts
- Barriers
- Cones
- Dynamic environments

## Advanced AI

- Self-play
- Population training
- Evolutionary strategies
- Vehicle-design optimization

---

# Guiding Principle

Keep the environment simple enough that learning is obvious and measurable.

Prove that the RL driver can learn to fight before increasing simulation complexity. Every additional system should be added only after the previous layer is producing reliable learning behavior.
