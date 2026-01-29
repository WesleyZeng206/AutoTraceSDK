# AI Incident Analysis Agent - Implementation Plan

## Overview

Build a LangGraph/LangChain-powered incident analysis system with **parallel specialized agents** and **feedback loops** for autonomous, iterative investigation.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Dashboard (Next.js, Port 3000)                                     │
│  - "Analyze" button on anomaly cards                                │
│  - Real-time analysis progress                                      │
│  - Incident report display                                          │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Agent Service (Python/Flask, Port 5001)                            │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    COORDINATOR AGENT                         │   │
│  │  - Orchestrates parallel investigation                       │   │
│  │  - Aggregates findings from specialist agents                │   │
│  │  - Decides if more investigation needed (feedback loop)      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                    │                                                │
│         ┌─────────┼─────────┬─────────────┐                        │
│         ▼         ▼         ▼             ▼                        │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐          │
│  │  Metrics  │ │  Events   │ │ Correlation│ │  Pattern  │          │
│  │  Analyst  │ │  Analyst  │ │  Analyst   │ │  Analyst  │          │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘          │
│         │           │             │             │                   │
│         └───────────┴─────────────┴─────────────┘                   │
│                           │                                         │
│                           ▼                                         │
│                  ┌─────────────────┐                               │
│                  │  FEEDBACK LOOP  │                               │
│                  │  - Confidence   │                               │
│                  │    check        │                               │
│                  │  - Request more │                               │
│                  │    data if low  │                               │
│                  └─────────────────┘                               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Ingestion Service (Express, Port 4000)                             │
│  - Existing APIs: /anomalies, /metrics, /routes, /telemetry, etc.   │
└─────────────────────────────────────────────────────────────────────┘
```

## Parallel Agent System

### Specialist Agents (Run in Parallel)

| Agent | Responsibility | Tools |
|-------|---------------|-------|
| **Metrics Analyst** | Analyze time-series data, identify trends, compare baselines | `fetch_metrics`, `fetch_stats` |
| **Events Analyst** | Examine raw events, find error patterns, identify outliers | `fetch_events`, `fetch_distribution` |
| **Correlation Analyst** | Check other services for related issues, find cascade failures | `list_services`, `fetch_anomalies` |
| **Pattern Analyst** | Compare to historical incidents, find recurring issues | `fetch_metrics` (historical), `fetch_routes` |

### Coordinator Agent

- Dispatches investigation tasks to specialist agents
- Runs specialists **in parallel** using LangGraph's `Send` API
- Aggregates findings into unified analysis
- Evaluates confidence level
- Triggers feedback loop if confidence < threshold

### Feedback Loop

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ┌─────────┐    ┌──────────┐    ┌─────────────────┐   │
│  │ Analyze │───▶│ Evaluate │───▶│ Confidence OK?  │   │
│  └─────────┘    │ Findings │    └────────┬────────┘   │
│       ▲         └──────────┘             │            │
│       │                            No    │   Yes      │
│       │         ┌──────────────┐◀────────┘    │       │
│       │         │ Request More │              │       │
│       └─────────│ Information  │              ▼       │
│                 └──────────────┘       ┌──────────┐   │
│                                        │  Report  │   │
│                                        └──────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Feedback triggers:**
- Confidence score < 0.7
- Contradictory evidence found
- Missing data for key time periods
- Unclear root cause

**Max iterations:** 3 (prevents infinite loops)

---

## Implementation Phases

### Phase 1: Agent Service Setup
- [ ] Create Python project with Flask
- [ ] Set up LangGraph with parallel execution
- [ ] Define base tool interfaces
- [ ] Basic health check endpoint

### Phase 2: Specialist Agents
- [ ] Metrics Analyst agent
- [ ] Events Analyst agent
- [ ] Correlation Analyst agent
- [ ] Pattern Analyst agent

### Phase 3: Coordinator & Feedback
- [ ] Coordinator agent with parallel dispatch
- [ ] Aggregation logic
- [ ] Confidence scoring
- [ ] Feedback loop implementation

### Phase 4: API & Integration
- [ ] Flask endpoints
- [ ] Dashboard integration
- [ ] Streaming progress updates

### Phase 5: Polish
- [ ] Error handling
- [ ] Caching
- [ ] Testing

---

## Project Structure

```
agent/
├── pyproject.toml
├── Dockerfile
├── .env.example
├── src/
│   ├── __init__.py
│   ├── app.py                 # Flask application
│   ├── config.py              # Configuration
│   │
│   ├── tools/                 # LangChain tools
│   │   ├── __init__.py
│   │   ├── base.py            # Base tool class with auth
│   │   ├── anomalies.py
│   │   ├── metrics.py
│   │   ├── events.py
│   │   ├── routes.py
│   │   └── services.py
│   │
│   ├── agents/                # Specialist agents
│   │   ├── __init__.py
│   │   ├── coordinator.py     # Main orchestrator
│   │   ├── metrics_analyst.py
│   │   ├── events_analyst.py
│   │   ├── correlation_analyst.py
│   │   └── pattern_analyst.py
│   │
│   ├── graph/                 # LangGraph workflow
│   │   ├── __init__.py
│   │   ├── state.py           # State definitions
│   │   ├── nodes.py           # Graph nodes
│   │   └── workflow.py        # Main graph definition
│   │
│   └── models/
│       ├── __init__.py
│       └── schemas.py         # Pydantic models
│
└── tests/
    ├── __init__.py
    ├── test_tools.py
    └── test_agents.py
```

---

## LangGraph Workflow

### State Definition

```python
from typing import TypedDict, Annotated, Sequence
from langgraph.graph import add_messages

class InvestigationState(TypedDict):
    # Input
    team_id: str
    anomaly: dict

    # Parallel agent findings
    metrics_findings: dict | None
    events_findings: dict | None
    correlation_findings: dict | None
    pattern_findings: dict | None

    # Aggregated analysis
    root_cause: str | None
    confidence: float
    evidence: list[dict]
    recommendations: list[str]

    # Feedback loop
    iteration: int
    needs_more_data: bool
    additional_queries: list[str]

    # Messages for agent reasoning
    messages: Annotated[Sequence[BaseMessage], add_messages]
```

### Graph Definition

```python
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode

def build_investigation_graph():
    graph = StateGraph(InvestigationState)

    # Nodes
    graph.add_node("coordinator", coordinator_node)
    graph.add_node("metrics_analyst", metrics_analyst_node)
    graph.add_node("events_analyst", events_analyst_node)
    graph.add_node("correlation_analyst", correlation_analyst_node)
    graph.add_node("pattern_analyst", pattern_analyst_node)
    graph.add_node("aggregator", aggregator_node)
    graph.add_node("evaluate", evaluate_confidence_node)
    graph.add_node("report", generate_report_node)

    # Parallel dispatch from coordinator
    graph.add_conditional_edges(
        "coordinator",
        dispatch_to_analysts,  # Returns list of Send() objects
        ["metrics_analyst", "events_analyst",
         "correlation_analyst", "pattern_analyst"]
    )

    # All analysts feed into aggregator
    graph.add_edge("metrics_analyst", "aggregator")
    graph.add_edge("events_analyst", "aggregator")
    graph.add_edge("correlation_analyst", "aggregator")
    graph.add_edge("pattern_analyst", "aggregator")

    # Aggregator -> Evaluate
    graph.add_edge("aggregator", "evaluate")

    # Feedback loop
    graph.add_conditional_edges(
        "evaluate",
        should_continue,
        {
            "continue": "coordinator",  # Loop back
            "finish": "report"
        }
    )

    graph.add_edge("report", END)
    graph.set_entry_point("coordinator")

    return graph.compile()
```

### Parallel Execution with Send

```python
from langgraph.types import Send

def dispatch_to_analysts(state: InvestigationState) -> list[Send]:
    """Dispatch tasks to all analysts in parallel."""
    anomaly = state["anomaly"]

    return [
        Send("metrics_analyst", {
            "task": "analyze_metrics",
            "anomaly": anomaly,
            "focus": "time_series_trends"
        }),
        Send("events_analyst", {
            "task": "analyze_events",
            "anomaly": anomaly,
            "focus": "error_patterns"
        }),
        Send("correlation_analyst", {
            "task": "find_correlations",
            "anomaly": anomaly,
            "focus": "cross_service"
        }),
        Send("pattern_analyst", {
            "task": "match_patterns",
            "anomaly": anomaly,
            "focus": "historical"
        }),
    ]
```

---

## Flask API Endpoints

### POST /analyze

Start an incident analysis.

```python
@app.route('/analyze', methods=['POST'])
def analyze_incident():
    data = request.json
    team_id = data['team_id']
    anomaly = data['anomaly']
    auth_token = request.headers.get('Authorization')

    # Run the investigation graph
    result = investigation_graph.invoke({
        "team_id": team_id,
        "anomaly": anomaly,
        "iteration": 0,
        "confidence": 0.0,
        "needs_more_data": False,
        "messages": []
    }, config={"configurable": {"auth_token": auth_token}})

    return jsonify({
        "analysis_id": str(uuid.uuid4()),
        "summary": result["root_cause"],
        "confidence": result["confidence"],
        "evidence": result["evidence"],
        "recommendations": result["recommendations"],
        "iterations": result["iteration"]
    })
```

### POST /analyze/stream

Stream analysis progress for real-time UI updates.

```python
@app.route('/analyze/stream', methods=['POST'])
def analyze_incident_stream():
    data = request.json

    def generate():
        for event in investigation_graph.stream({...}):
            yield f"data: {json.dumps(event)}\n\n"

    return Response(generate(), mimetype='text/event-stream')
```

### POST /followup

Ask follow-up questions about an analysis.

```python
@app.route('/followup', methods=['POST'])
def followup_question():
    data = request.json
    analysis_id = data['analysis_id']
    question = data['question']

    # Continue conversation with context
    result = followup_graph.invoke({
        "analysis_id": analysis_id,
        "question": question
    })

    return jsonify({
        "answer": result["answer"],
        "sources": result["sources"]
    })
```

---

## Specialist Agent Prompts

### Metrics Analyst

```
You are a Metrics Analyst investigating a performance anomaly.

Your job is to:
1. Fetch time-series metrics around the incident time
2. Identify trends (increasing latency, error spikes)
3. Compare current values to baseline
4. Note any sudden changes or gradual degradation

Focus on: {anomaly.service_name} - {anomaly.route}
Time of incident: {anomaly.time_bucket}
Metric type: {anomaly.metric}

Use the available tools to gather data, then provide your findings.
```

### Events Analyst

```
You are an Events Analyst investigating a performance anomaly.

Your job is to:
1. Fetch raw request events around the incident time
2. Look for error patterns (specific error types, messages)
3. Identify outlier requests (very slow, failing)
4. Note any common characteristics of problematic requests

Focus on: {anomaly.service_name} - {anomaly.route}
Time of incident: {anomaly.time_bucket}

Use the available tools to gather data, then provide your findings.
```

### Correlation Analyst

```
You are a Correlation Analyst investigating a performance anomaly.

Your job is to:
1. Check if other services are experiencing issues
2. Look for cascade failures (Service A failing causes Service B issues)
3. Identify shared dependencies that might be the root cause
4. Check for anomalies in upstream/downstream services

Primary service: {anomaly.service_name}
Time of incident: {anomaly.time_bucket}

Use the available tools to gather data, then provide your findings.
```

### Pattern Analyst

```
You are a Pattern Analyst investigating a performance anomaly.

Your job is to:
1. Look for similar historical incidents
2. Check if this is a recurring issue (same time of day, day of week)
3. Identify if this pattern has happened before
4. Note any seasonal or cyclical patterns

Service: {anomaly.service_name} - {anomaly.route}
Current incident: {anomaly.time_bucket}

Use the available tools to gather historical data, then provide your findings.
```

### Coordinator Aggregation

```
You are the Lead Investigator coordinating an incident analysis.

You have received findings from your specialist team:

METRICS ANALYST FINDINGS:
{metrics_findings}

EVENTS ANALYST FINDINGS:
{events_findings}

CORRELATION ANALYST FINDINGS:
{correlation_findings}

PATTERN ANALYST FINDINGS:
{pattern_findings}

Synthesize these findings into a coherent root cause analysis.
Consider:
1. Do the findings support each other or contradict?
2. What is the most likely root cause?
3. How confident are you in this conclusion?
4. What actions should be taken?

If confidence is low or findings are contradictory, specify what additional information would help.
```

---

## Dependencies

```toml
[project]
name = "autotrace-agent"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "flask>=3.0.0",
    "langchain>=0.3.0",
    "langgraph>=0.2.0",
    "langchain-anthropic>=0.3.0",
    "httpx>=0.27.0",
    "pydantic>=2.5.0",
    "python-dotenv>=1.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
]
```

---

## Environment Variables

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-...
INGESTION_SERVICE_URL=http://localhost:4000
AGENT_PORT=5001
MAX_ITERATIONS=3
CONFIDENCE_THRESHOLD=0.7
```

---

## Docker Integration

```yaml
# Add to docker-compose.yml
agent:
  build: ./agent
  ports:
    - "5001:5001"
  environment:
    - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    - INGESTION_SERVICE_URL=http://ingestion:4000
    - MAX_ITERATIONS=3
    - CONFIDENCE_THRESHOLD=0.7
  depends_on:
    - ingestion
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:5001/health"]
    interval: 30s
    timeout: 10s
    retries: 3
```

---

## Success Metrics

1. **Performance**: Full analysis completes in <15 seconds
2. **Accuracy**: Root cause correctly identified >80% of the time
3. **Autonomy**: Feedback loop improves confidence by >20% on average
4. **Coverage**: All 4 specialist perspectives contribute to analysis
5. **Actionability**: Recommendations are specific and implementable
