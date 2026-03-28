# Dummy Explanation

This is the dumb-simple version of how the system works.

## What The Product Should Output

The main output should be:

`Simulation Replay with Agent Debates`

Main view:

- split screen
- left side = timeline replay of the simulation tick by tick
- right side = chat-style view of what agents are thinking, reacting to, and sharing

## The Main Idea

There is:

- one shared pool of claims
- many agents
- one private prompt per agent on each tick

The agents do not all think in one giant prompt.

The system works like this:

1. The system generates a bunch of claims about the market.
2. Those claims are saved in a shared claim pool.
3. Every agent looks at claims from that pool.
4. Each agent forms its own belief.
5. Agents can send specific claims to other agents.
6. On the next tick, the receiving agent sees that shared claim.
7. That may change the receiving agent's belief.

## What Is A Claim?

A claim is a piece of evidence or an argument about the market.

Example:

- "Labor market is weakening"
- "Inflation is still too high"
- "Fed officials sound more dovish"

Each claim gets a `stance`.

`stance` means which way the claim points:

- `yes` = this claim supports YES
- `no` = this claim supports NO

Important:

- stance belongs to the claim
- belief belongs to the agent

## What Is Belief?

Belief is the agent's own opinion about the market.

Example:

- Ava belief = 0.54
- Blake belief = 0.46
- Casey belief = 0.58

That means:

- Ava thinks there is a 54% chance of YES
- Blake thinks there is a 46% chance of YES
- Casey thinks there is a 58% chance of YES

So:

- claim stance = direction of evidence
- agent belief = personal probability

## Who Creates The Claims?

Not the agents.

The system first does one claims-generation step for the whole market.

That step creates the shared claim pool.

So it is not:

- one agent creates all the claims
- or each agent creates its own claim pool

It is:

- one separate claim generator creates claims for the session
- agents react to those claims later

## What Does Each Agent See?

Each agent gets its own private prompt.

That prompt includes:

- the agent's current belief
- the agent's confidence
- some visible claims from the shared claim pool
- any incoming shared claims sent by other agents
- who the agent trusts

So each agent gets its own packet of information.

Think of it like this:

- claim pool = library
- visible claims = books put on your desk
- incoming claims = notes someone specifically passed to you

## What Are Shared Claims?

Shared claims are how agents interact with each other.

Example:

1. Ava reads claim-2.
2. Ava thinks it is important.
3. Ava tells the backend:
   - send claim-2 to Blake
   - attach this commentary
4. The backend stores that share.
5. On the next tick, Blake sees claim-2 in his incoming claims.

So agents do not live-chat.

They interact by sending claims through the backend.

## Do All Shared Claims Go To Every Agent?

No.

Shared claims are targeted.

If Ava sends a claim to Blake, then Blake sees it next tick.

That does not mean Casey also sees it.

So:

- public claims can be common
- shared claims are directed

## How Does A Claim Change An Agent's Opinion?

A claim influences an agent because it appears in that agent's prompt.

The agent reads:

- current belief
- visible claims
- incoming shared claims

Then the LLM acting as that agent decides:

- update belief
- or share a claim

Example:

- Blake starts at 0.44
- Blake receives a shared claim from Ava
- Blake reads the claim and Ava's commentary
- Blake updates to 0.51

That means the claim influenced Blake's opinion.

## How Does An Agent Choose Who To Send A Claim To?

The agent chooses:

- which claim to share
- which agent to send it to

The backend gives the agent context like:

- who it trusts
- maybe who is likely to listen

So the agent might think:

- "I trust Blake, so I will send it to Blake"
- "Ava is influential, so I want Ava to see this"

So agents do not send claims randomly.

They choose targets based on the context in their prompt.

## Very Short Example

Market:

`Will the Fed cut rates before September 2025?`

Claim pool:

- claim-1: "Inflation remains above target" -> stance `no`
- claim-2: "Labor market is weakening" -> stance `yes`

Agent beliefs at start:

- Ava = 0.54
- Blake = 0.46

Tick 1:

- Ava sees claim-2 and sends it to Blake
- Blake updates his own belief to 0.44

End of Tick 1:

- backend stores: Ava sent claim-2 to Blake

Tick 2:

- Blake now sees claim-2 from Ava
- Blake reads Ava's commentary
- Blake updates from 0.44 to 0.51

That is the interaction.

## The Whole System In One Sentence

The system creates one shared evidence pool, each agent forms its own opinion from that evidence, and agents influence each other by sending selected claims to specific other agents over time.
