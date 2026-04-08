const chatTimeline = [
  {
    author: 'Avery',
    role: 'PM',
    type: 'proposal',
    title: 'Proposal: ship threaded voting this sprint',
    body:
      'Goal is to unblock async decisions without forcing every conversation into a meeting. Need engineering estimate and owner.',
    meta: 'Proposal open 16m ago',
  },
  {
    author: 'Jules',
    role: 'Design',
    type: 'message',
    title: 'Concern',
    body: 'We should lock the interaction model before adding emojis, otherwise votes and reactions will overlap.',
    meta: '1 reply, 2 agrees',
  },
  {
    author: 'Mina',
    role: 'Engineering',
    type: 'vote',
    title: 'Vote cast',
    body: 'Approve if scope is limited to yes / no / abstain in channel and summary in sidebar.',
    meta: 'Approve with condition',
  },
];

const decisionCards = [
  { label: 'Open proposals', value: '3' },
  { label: 'Votes pending', value: '7' },
  { label: 'Consensus score', value: '74%' },
  { label: 'Decision due', value: 'Today 4:00 PM' },
];

const callAgenda = [
  'Review proposal context',
  'Hear objections',
  'Run live vote',
  'Assign owner and next step',
];

const participants = [
  { name: 'Avery', state: 'Presenting proposal' },
  { name: 'Mina', state: 'Has objection queued' },
  { name: 'Jules', state: 'Ready to vote' },
  { name: 'Owen', state: 'Waiting on scope' },
];

export default function DecisionWireframePage() {
  return (
    <section className="page-panel">
      <header className="page-header decision-header">
        <div>
          <p className="page-eyebrow">Wireframe</p>
          <h2 className="page-title">Collaborative Decisions</h2>
        </div>

        <p className="decision-summary">
          Separate chat and call views, both optimized around proposals, voting, objections, and clear outcomes.
        </p>
      </header>

      <div className="wireframe-brief">
        <div className="wireframe-note">
          <span className="wireframe-chip">Repo context</span>
          <p>
            `README.md` is still the default Vite scaffold, so this wireframe establishes product structure rather
            than extending existing domain flows.
          </p>
        </div>

        <div className="decision-metrics">
          {decisionCards.map((card) => (
            <article key={card.label} className="metric-card">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </article>
          ))}
        </div>
      </div>

      <div className="wireframe-grid">
        <section className="wireframe-surface">
          <div className="surface-header">
            <div>
              <p className="surface-kicker">View A</p>
              <h3>Chat workspace</h3>
            </div>
            <div className="surface-tabs" aria-label="Chat view modes">
              <span className="active">Chat</span>
              <span>Proposal board</span>
              <span>Decision log</span>
            </div>
          </div>

          <div className="chat-wireframe">
            <aside className="channel-rail">
              <div className="rail-block">
                <span className="rail-label">Spaces</span>
                <button className="rail-item active">Launch</button>
                <button className="rail-item">Pricing</button>
                <button className="rail-item">Hiring</button>
              </div>

              <div className="rail-block">
                <span className="rail-label">Decision filters</span>
                <button className="rail-item">Open</button>
                <button className="rail-item">Needs vote</button>
                <button className="rail-item">Resolved</button>
              </div>
            </aside>

            <main className="chat-main">
              <div className="chat-toolbar">
                <strong># mobile-redesign</strong>
                <div className="toolbar-pills">
                  <span>12 participants</span>
                  <span>2 open proposals</span>
                  <span>Jump to latest vote</span>
                </div>
              </div>

              <div className="chat-timeline">
                {chatTimeline.map((item) => (
                  <article key={`${item.author}-${item.title}`} className={`timeline-card ${item.type}`}>
                    <div className="timeline-meta">
                      <strong>{item.author}</strong>
                      <span>{item.role}</span>
                    </div>
                    <h4>{item.title}</h4>
                    <p>{item.body}</p>
                    <small>{item.meta}</small>
                  </article>
                ))}
              </div>

              <div className="composer-shell">
                <div className="composer-actions">
                  <button>Message</button>
                  <button className="active">New proposal</button>
                  <button>Request vote</button>
                </div>
                <div className="composer-box">
                  Draft proposal, define options, set deadline, and attach a decision owner.
                </div>
              </div>
            </main>

            <aside className="decision-sidebar">
              <div className="sidebar-card">
                <span className="sidebar-label">Active proposal</span>
                <h4>Ship threaded voting</h4>
                <p>Decision owner: Avery</p>
                <p>Deadline: Today 4:00 PM</p>
              </div>

              <div className="sidebar-card">
                <span className="sidebar-label">Live vote</span>
                <div className="vote-row">
                  <span>Approve</span>
                  <strong>5</strong>
                </div>
                <div className="vote-row">
                  <span>Block</span>
                  <strong>1</strong>
                </div>
                <div className="vote-row">
                  <span>Abstain</span>
                  <strong>2</strong>
                </div>
              </div>

              <div className="sidebar-card">
                <span className="sidebar-label">Decision output</span>
                <p>When resolved, post final summary into thread and pin it to the decision log.</p>
              </div>
            </aside>
          </div>
        </section>

        <section className="wireframe-surface">
          <div className="surface-header">
            <div>
              <p className="surface-kicker">View B</p>
              <h3>Video call workspace</h3>
            </div>
            <div className="surface-tabs" aria-label="Call view modes">
              <span>Lobby</span>
              <span className="active">Call</span>
              <span>Outcome</span>
            </div>
          </div>

          <div className="call-wireframe">
            <div className="call-stage">
              <div className="stage-header">
                <strong>Decision call: Mobile redesign</strong>
                <div className="toolbar-pills">
                  <span>00:18:42</span>
                  <span>Recording summary on</span>
                  <span>Vote pending</span>
                </div>
              </div>

              <div className="speaker-panel">
                <div className="speaker-main">
                  <span>Presenter</span>
                  <strong>Avery walking through proposal</strong>
                </div>
                <div className="speaker-side-grid">
                  {participants.map((participant) => (
                    <div key={participant.name} className="participant-tile">
                      <strong>{participant.name}</strong>
                      <span>{participant.state}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="call-controls">
                <button>Mute</button>
                <button>Raise objection</button>
                <button className="active">Start vote</button>
                <button>Capture decision</button>
              </div>
            </div>

            <aside className="call-sidebar">
              <div className="sidebar-card">
                <span className="sidebar-label">Agenda</span>
                <ol className="agenda-list">
                  {callAgenda.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              </div>

              <div className="sidebar-card">
                <span className="sidebar-label">Live vote panel</span>
                <p>Voting opens as an overlay for all participants without leaving the call.</p>
                <div className="vote-actions">
                  <button>Approve</button>
                  <button>Block</button>
                  <button>Abstain</button>
                </div>
              </div>

              <div className="sidebar-card">
                <span className="sidebar-label">Decision transcript</span>
                <p>Objections and commitments are converted into a final summary before ending the meeting.</p>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </section>
  );
}
