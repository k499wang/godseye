# Example Simulation Flow

This file shows the intended system flow in plain English with made-up example data.

Intended primary output:

- `Simulation Replay with Agent Debates`
- split-screen main view
- left side = tick-by-tick simulation replay
- right side = chat-style agent debate/thought feed for the selected tick

It is consistent with the design docs:

- One LLM prompt generates the shared claim pool for the session.
- Then each agent gets its own prompt on each tick.
- Agents do not directly read each other's minds or prompts.
- The backend routes shared claims from one tick into another agent's next prompt.

## 1. High-Level Flow

1. User selects a market.
2. System sends one claims-generation prompt.
3. LLM returns a list of claims.
4. System saves those claims.
5. System creates agents with different personalities.
6. Simulation starts.
7. On each tick, the backend builds one private prompt per agent.
8. Each agent returns one action:
   - `update_belief`
   - or `share_claim`
9. Backend collects all actions.
10. Backend updates beliefs, routes shared claims, updates trust, and starts the next tick.

## 2. Example Market

Market question:

`Will the Federal Reserve cut interest rates before September 2025?`

Resolution criteria:

`Resolves YES if the Federal Reserve announces at least one rate cut before September 1, 2025. Otherwise resolves NO.`

## 3. Example Claims Generation Prompt

This is the one global prompt that creates the initial claim pool.

```text
System:
You are a market analysis assistant. Generate 20-30 structured claims relevant to this prediction market.

User:
Market question:
Will the Federal Reserve cut interest rates before September 2025?

Resolution criteria:
Resolves YES if the Federal Reserve announces at least one rate cut before September 1, 2025.

Return JSON with:
- text
- stance
- strength_score
- novelty_score

Focus on claims that would materially affect the probability of the market resolving YES or NO.
```

## 4. Example Claims Generation Output

```json
{
  "claims": [
    {
      "claim_id": "claim-1",
      "text": "Core inflation remains above the Federal Reserve's target.",
      "stance": "no",
      "strength_score": 0.79,
      "novelty_score": 0.40
    },
    {
      "claim_id": "claim-2",
      "text": "Recent labor market data shows signs of slowing employment growth.",
      "stance": "yes",
      "strength_score": 0.72,
      "novelty_score": 0.55
    },
    {
      "claim_id": "claim-3",
      "text": "Several Fed officials have recently used more dovish language.",
      "stance": "yes",
      "strength_score": 0.68,
      "novelty_score": 0.48
    },
    {
      "claim_id": "claim-4",
      "text": "Consumer spending remains resilient, reducing pressure for near-term cuts.",
      "stance": "no",
      "strength_score": 0.66,
      "novelty_score": 0.44
    }
  ]
}
```

The backend stores these claims in the database. This is the shared pool the simulation can use.

## 5. Example Agents

The system creates agents with different styles.

```json
[
  {
    "agent_id": "agent-a",
    "name": "Ava",
    "archetype": "Quantitative analyst",
    "current_probability": 0.54,
    "confidence": 0.63
  },
  {
    "agent_id": "agent-b",
    "name": "Blake",
    "archetype": "Data skeptic",
    "current_probability": 0.46,
    "confidence": 0.70
  },
  {
    "agent_id": "agent-c",
    "name": "Casey",
    "archetype": "Trend follower",
    "current_probability": 0.58,
    "confidence": 0.57
  }
]
```

Example trust relationships:

- Ava trusts Blake: `0.62`
- Blake trusts Ava: `0.78`
- Casey trusts Ava: `0.71`

## 5A. One Concrete Example Before The Full Walkthrough

This is the shortest version of the whole system using one claim.

Shared claim in the database:

```json
{
  "claim_id": "claim-2",
  "text": "Recent labor market data shows signs of slowing employment growth.",
  "stance": "yes",
  "strength_score": 0.72,
  "novelty_score": 0.55
}
```

What this means:

- the system says this claim points toward a YES outcome
- every agent can read this same claim
- every agent is free to react differently

How three agents can react to the exact same claim:

```text
Ava sees claim-2 and thinks:
"This is meaningful evidence. I should move up a bit."

Blake sees claim-2 and thinks:
"This is not enough by itself. Inflation still matters more."

Casey sees claim-2 and thinks:
"This matches the market mood. I should share this with someone else."
```

So:

- same claim
- same stored stance
- different agent beliefs
- different agent actions

That is the core idea of the simulation.

## 6. Tick 1: What Each Agent Sees

At the start of Tick 1, nobody has received any targeted claim shares yet.

### Tick 1 Snapshot

Before any agent acts, the world state looks like this:

```text
Claim pool:
- claim-1 -> stance no
- claim-2 -> stance yes
- claim-3 -> stance yes
- claim-4 -> stance no

Agent beliefs:
- Ava -> 0.54
- Blake -> 0.46
- Casey -> 0.58

Incoming shared claims:
- Ava -> none
- Blake -> none
- Casey -> none
```

At this moment:

- all agents can see the common visible claims
- no agent has received any private shared claims yet
- each agent must decide one action for this tick

### Agent A Prompt

```text
System:
You are Ava, a Quantitative analyst forecaster.

Context:
- Your current belief: 0.54
- Your confidence: 0.63
- Agents you trust: Blake, Casey
- Recent claims shared: none
- Claims shared with you this tick: none

Visible claims:
1. [claim-1] Core inflation remains above the Federal Reserve's target. (stance: no)
2. [claim-2] Recent labor market data shows signs of slowing employment growth. (stance: yes)
3. [claim-3] Several Fed officials have recently used more dovish language. (stance: yes)
4. [claim-4] Consumer spending remains resilient, reducing pressure for near-term cuts. (stance: no)

Choose one action:
- update_belief
- share_claim

Return JSON only.
```

### Example Agent A Output

```json
{
  "action": "share_claim",
  "claim_id": "claim-2",
  "target_agent_ids": ["agent-b"],
  "commentary": "Slowing employment growth is the strongest near-term signal supporting a cut.",
  "reasoning": "Blake is skeptical and should see the labor data argument directly."
}
```

What happened here:

- Ava did not change her belief directly in this action
- Ava chose one existing claim from the shared pool
- Ava chose Blake as the recipient
- Ava attached commentary to try to influence Blake next tick

### Agent B Prompt

```text
System:
You are Blake, a Data skeptic forecaster.

Context:
- Your current belief: 0.46
- Your confidence: 0.70
- Agents you trust: Ava
- Recent claims shared: none
- Claims shared with you this tick: none

Visible claims:
1. [claim-1] Core inflation remains above the Federal Reserve's target. (stance: no)
2. [claim-2] Recent labor market data shows signs of slowing employment growth. (stance: yes)
3. [claim-3] Several Fed officials have recently used more dovish language. (stance: yes)
4. [claim-4] Consumer spending remains resilient, reducing pressure for near-term cuts. (stance: no)

Choose one action:
- update_belief
- share_claim

Return JSON only.
```

### Example Agent B Output

```json
{
  "action": "update_belief",
  "new_probability": 0.44,
  "confidence": 0.73,
  "reasoning": "Inflation still looks too elevated for a confident near-term cut."
}
```

What happened here:

- Blake looked at the same visible claims Ava saw
- Blake was not persuaded enough to share anything
- Blake changed only his own belief from `0.46` to `0.44`

### Agent C Prompt

```text
System:
You are Casey, a Trend follower forecaster.

Context:
- Your current belief: 0.58
- Your confidence: 0.57
- Agents you trust: Ava
- Recent claims shared: none
- Claims shared with you this tick: none

Visible claims:
1. [claim-1] Core inflation remains above the Federal Reserve's target. (stance: no)
2. [claim-2] Recent labor market data shows signs of slowing employment growth. (stance: yes)
3. [claim-3] Several Fed officials have recently used more dovish language. (stance: yes)
4. [claim-4] Consumer spending remains resilient, reducing pressure for near-term cuts. (stance: no)

Choose one action:
- update_belief
- share_claim

Return JSON only.
```

### Example Agent C Output

```json
{
  "action": "share_claim",
  "claim_id": "claim-3",
  "target_agent_ids": ["agent-a"],
  "commentary": "The broader tone from Fed speakers is becoming more supportive of cuts.",
  "reasoning": "Ava is likely to weigh this as a secondary confirming signal."
}
```

What happened here:

- Casey also looked at the same visible claims
- Casey chose a different claim than Ava
- Casey sent that claim to Ava for the next tick

## 7. End Of Tick 1: What The Backend Does

After all agent outputs are collected, the backend processes them.

### Stored Agent Actions

```json
[
  {
    "agent_id": "agent-a",
    "action": "share_claim",
    "claim_id": "claim-2",
    "target_agent_ids": ["agent-b"]
  },
  {
    "agent_id": "agent-b",
    "action": "update_belief",
    "new_probability": 0.44
  },
  {
    "agent_id": "agent-c",
    "action": "share_claim",
    "claim_id": "claim-3",
    "target_agent_ids": ["agent-a"]
  }
]
```

### Stored Claim Shares

```json
[
  {
    "from_agent_id": "agent-a",
    "to_agent_ids": ["agent-b"],
    "claim_id": "claim-2",
    "commentary": "Slowing employment growth is the strongest near-term signal supporting a cut.",
    "tick_number": 1
  },
  {
    "from_agent_id": "agent-c",
    "to_agent_ids": ["agent-a"],
    "claim_id": "claim-3",
    "commentary": "The broader tone from Fed speakers is becoming more supportive of cuts.",
    "tick_number": 1
  }
]
```

### Important Rule

The share does not appear instantly.

If Ava shares a claim to Blake during Tick 1, Blake sees it in Tick 2.

That is the key idea behind the simulation loop.

### Tick 1 In Plain English

End of Tick 1:

- Ava said: "Send claim-2 to Blake"
- Blake said: "My belief moves from 0.46 to 0.44"
- Casey said: "Send claim-3 to Ava"

The backend then updates the world state to:

```text
Beliefs after Tick 1:
- Ava -> 0.54
- Blake -> 0.44
- Casey -> 0.58

Scheduled deliveries for Tick 2:
- Ava will receive claim-3 from Casey
- Blake will receive claim-2 from Ava
- Casey will receive nothing
```

This is the exact handoff between one round and the next.

## 8. Tick 2: How Agents See Shared Claims

Now the backend assembles the next round of private prompts.

### Agent B Input On Tick 2

Blake now receives the claim Ava sent during Tick 1.

```json
{
  "agent": {
    "agent_id": "agent-b",
    "name": "Blake",
    "current_probability": 0.44,
    "confidence": 0.73
  },
  "visible_claims": [
    {
      "claim_id": "claim-1",
      "text": "Core inflation remains above the Federal Reserve's target.",
      "stance": "no"
    },
    {
      "claim_id": "claim-2",
      "text": "Recent labor market data shows signs of slowing employment growth.",
      "stance": "yes"
    },
    {
      "claim_id": "claim-3",
      "text": "Several Fed officials have recently used more dovish language.",
      "stance": "yes"
    },
    {
      "claim_id": "claim-4",
      "text": "Consumer spending remains resilient, reducing pressure for near-term cuts.",
      "stance": "no"
    }
  ],
  "incoming_claims": [
    {
      "claim_id": "claim-2",
      "from_agent_id": "agent-a",
      "from_agent_name": "Ava",
      "commentary": "Slowing employment growth is the strongest near-term signal supporting a cut.",
      "tick_shared": 1
    }
  ],
  "trusted_agents": [
    {
      "agent_id": "agent-a",
      "name": "Ava",
      "trust_weight": 0.78
    }
  ]
}
```

### Agent B Prompt On Tick 2

```text
System:
You are Blake, a Data skeptic forecaster.

Context:
- Your current belief: 0.44
- Your confidence: 0.73
- Agents you trust: Ava
- Recent claims shared: claim-2 from Ava
- Claims shared with you this tick:
  - [claim-2] Recent labor market data shows signs of slowing employment growth.
    Commentary from Ava: Slowing employment growth is the strongest near-term signal supporting a cut.

Visible claims:
1. [claim-1] Core inflation remains above the Federal Reserve's target. (stance: no)
2. [claim-2] Recent labor market data shows signs of slowing employment growth. (stance: yes)
3. [claim-3] Several Fed officials have recently used more dovish language. (stance: yes)
4. [claim-4] Consumer spending remains resilient, reducing pressure for near-term cuts. (stance: no)

Choose one action:
- update_belief
- share_claim

Return JSON only.
```

### Example Agent B Output On Tick 2

```json
{
  "action": "update_belief",
  "new_probability": 0.51,
  "confidence": 0.71,
  "reasoning": "Ava's commentary makes claim-2 more persuasive, though inflation still limits confidence."
}
```

This is the key interaction:

- Ava influenced Blake without talking live
- the influence happened because the backend delivered Ava's shared claim into Blake's next prompt
- Blake then updated his own belief after seeing both the claim and Ava's commentary

### Agent A Input On Tick 2

Ava now receives the claim Casey sent during Tick 1.

```json
{
  "incoming_claims": [
    {
      "claim_id": "claim-3",
      "from_agent_id": "agent-c",
      "from_agent_name": "Casey",
      "commentary": "The broader tone from Fed speakers is becoming more supportive of cuts.",
      "tick_shared": 1
    }
  ]
}
```

### Tick 2 Snapshot

At the start of Tick 2, the world now looks like this:

```text
Claim pool:
- claim-1 -> stance no
- claim-2 -> stance yes
- claim-3 -> stance yes
- claim-4 -> stance no

Agent beliefs:
- Ava -> 0.54
- Blake -> 0.44
- Casey -> 0.58

Incoming shared claims:
- Ava -> claim-3 from Casey
- Blake -> claim-2 from Ava
- Casey -> none
```

This makes the role split very clear:

- the claim pool still exists for everyone
- beliefs are agent-specific
- incoming shares are agent-specific

## 9. Why This Is Not One Giant Shared Prompt

The system is not structured like this:

- one big prompt
- all agents think together
- all agents instantly see each other's fresh outputs

Instead it works like this:

- one claim-generation prompt creates the shared claim pool
- one private prompt per agent is built on every tick
- the backend collects all responses
- the backend routes claim shares into the next tick

The backend is the mailman.

Agents do not directly open each other's prompts.

## 10. Simple Mental Model

Think of each tick as one round in a classroom.

- Public claims are the worksheet everyone receives.
- Shared claims are notes passed between students.
- The teacher collects the notes at the end of the round.
- On the next round, the teacher hands those notes to the intended recipients.

That is how one agent "sees" another agent's claim.

## 11. End-To-End Summary

1. Generate claims once.
2. Save claims.
3. Create agents.
4. Start Tick 1.
5. Build one prompt for each agent.
6. Each agent returns one action.
7. Backend stores belief updates and claim shares.
8. Shared claims are delivered to recipients on the next tick.
9. Repeat for 30 ticks.

That is the complete flow described by the design docs.

## 12. How Claim Stance Is Decided

Claim stance is not decided separately by each agent.

The intended design is:

1. The claims-generation LLM creates the initial claims.
2. Each claim is labeled with a `stance`.
3. That claim is saved in the database.
4. Agents later read that saved claim and react to it.

So if the system stores:

```json
{
  "claim_id": "claim-2",
  "text": "Recent labor market data shows signs of slowing employment growth.",
  "stance": "yes",
  "strength_score": 0.72,
  "novelty_score": 0.55
}
```

Then all agents see the same base claim with the same base stance.

Agents do not regenerate the stance field from scratch on every tick.

What agents do decide is:

- whether they find the claim persuasive
- how much it should move their probability
- whether to share it with someone else
- what commentary to attach when they share it

So:

- `stance` belongs to the claim record
- belief update belongs to the agent

### Plain-English Meaning Of Stance

`stance: "yes"` means the claim supports the market resolving YES.

`stance: "no"` means the claim supports the market resolving NO.

It does not mean every agent agrees with that label emotionally.
It means the claim is categorized as evidence pointing in one direction.

### Example

If the market is:

`Will the Fed cut rates before September 2025?`

Then:

- `The labor market is weakening` might get stance `yes`
- `Inflation remains above target` might get stance `no`

An individual agent can still respond differently:

- one agent may strongly believe the `yes` claim matters
- another agent may think it is weak evidence
- another agent may ignore it entirely

But the stored claim stance stays the same unless the backend later adds a separate revision step.

## 12A. Stance Versus Belief

This is the distinction that usually causes confusion.

### Stance

Stance belongs to the claim.

Example:

```text
claim-2:
"Recent labor market data shows signs of slowing employment growth."
stance = yes
```

Meaning:

- this claim points toward the market resolving YES

### Belief

Belief belongs to the agent.

Example:

```text
Ava belief = 0.54
Blake belief = 0.46
Casey belief = 0.58
```

Meaning:

- Ava currently thinks the market has a 54% chance of resolving YES
- Blake currently thinks the market has a 46% chance of resolving YES
- Casey currently thinks the market has a 58% chance of resolving YES

### Side-By-Side Example

```text
Claim:
"Labor market is weakening"
Stored stance: yes

Ava's reaction:
"This supports a cut. I care about this."

Blake's reaction:
"This supports yes, but I think inflation is stronger."

Casey's reaction:
"This supports yes and is worth forwarding."
```

The important thing is:

- all three agents can agree that the claim points toward YES
- while still disagreeing about how much the claim matters

So agents do not each own a separate stance field.
They each own their own belief.

## 13. Recommended Rule For Visible Claims

The docs say the simulation runner retrieves claims from the database and passes `visible claims` into the agent prompt, but they do not define the exact filtering algorithm.

The cleanest recommended implementation is:

1. Load all claims for the analysis session.
2. Rank them.
3. Select the top N as `visible_claims`.
4. Add any direct shares separately as `incoming_claims`.

### Recommended Ranking

Use a simple weighted score:

```text
claim_rank = 0.7 * strength_score + 0.3 * novelty_score
```

Then:

1. Sort claims by `claim_rank` descending.
2. Keep the top 8 to 12 claims for `visible_claims`.
3. Ensure some stance balance if possible.

### Recommended Selection Rules

Good MVP rules:

- always include some `yes` claims and some `no` claims
- prefer high-strength claims
- use novelty as a tiebreaker
- keep the list short enough to fit comfortably in each agent prompt

Example:

```text
Visible claims selection:
- top 4 highest-ranked YES claims
- top 4 highest-ranked NO claims
- optional 2 wildcard claims by novelty
```

This avoids giving agents a lopsided prompt where all visible claims point one way.

### Incoming Claims Are Separate

Do not mix targeted shares into the base `visible_claims` ranking.

Instead:

- `visible_claims` = public/common claims chosen by the runner
- `incoming_claims` = claims specifically sent to this agent by other agents

That means a weak claim might still appear for a given agent if a trusted peer shared it directly.

## 14. Recommended Backend Pseudocode

```text
claims = load_claims_for_session(session_id)

for claim in claims:
    claim.rank = 0.7 * claim.strength_score + 0.3 * claim.novelty_score

yes_claims = sort_desc([c for c in claims if c.stance == "yes"], key=rank)
no_claims = sort_desc([c for c in claims if c.stance == "no"], key=rank)

visible_claims = take(4, yes_claims) + take(4, no_claims)

incoming_claims = load_claim_shares_for_agent(agent_id, tick_number)

prompt_input = {
  "visible_claims": visible_claims,
  "incoming_claims": incoming_claims
}
```

## 15. Short Answer

No, stance is not generated by each agent.

The intended design is:

- one claims-generation step creates the claims and their stances
- the backend stores them
- later, each agent gets those stored claims in its prompt
- each agent forms its own opinion about them

So agents interpret claims.
They do not define the claim stance field.

## 16. Glossary

### Claim Pool

The full set of claims generated once for a market before the simulation starts.

Example:

- `claim-1`: Inflation remains above target
- `claim-2`: Labor market is weakening
- `claim-3`: Fed speakers sound more dovish

This is the shared evidence library for the whole simulation.

### Visible Claims

The normal claims the backend includes in an agent's prompt on a given tick.

These usually come from the claim pool.

Think of them as:

- the common worksheet
- the baseline evidence available to think about

### Shared Claims

Claims that one agent intentionally sends to another agent.

These are the mechanism of agent-to-agent interaction.

Example:

- Ava sends `claim-2` to Blake with commentary

That means the backend records the share and gives it to Blake on the next tick.

### Incoming Claims

The shared claims that were specifically delivered to one agent on this tick.

Example:

- Blake's incoming claims might include:
  - `claim-2` from Ava
  - commentary: "This is the strongest labor signal"

So:

- `shared claims` describes the act of sending
- `incoming claims` describes what the receiving agent sees

### Stance

The direction a claim points relative to the market outcome.

Example:

- `stance: "yes"` means the claim supports a YES resolution
- `stance: "no"` means the claim supports a NO resolution

Stance belongs to the claim record.
It is not the same thing as an agent's opinion.

### Belief

An individual agent's current probability estimate.

Example:

- Ava belief: `0.54`
- Blake belief: `0.46`

Two agents can see the same claim and still have different beliefs.

### Belief Update

When an agent changes its own probability after considering claims.

Example:

- Blake moves from `0.46` to `0.51`

That is Blake reacting to evidence.

### Agent Interaction

The way agents influence one another during the simulation.

In this design, interaction mainly happens through:

- sharing claims
- receiving incoming claims
- updating trust over time

So the shortest correct summary is:

- claim pool = shared evidence
- visible claims = what the backend shows you normally
- shared claims = what another agent sends you
- incoming claims = shared claims you receive
- belief = your own opinion

## 17. Very Concrete Summary

If you only remember five things, remember these:

1. One LLM call creates the claim pool for the market.
2. Each claim gets one stored stance like `yes` or `no`.
3. Each agent has its own belief like `0.54` or `0.46`.
4. On each tick, every agent gets its own private prompt.
5. Agents interact by sharing claims, which show up in the recipient's next prompt.

### In One Sentence

Claims are shared evidence.
Beliefs are private opinions.
Shared claims are how agents influence each other.
