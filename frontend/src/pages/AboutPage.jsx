export default function AboutPage() {
  return (
    <div className="page-placeholder">
      <h2>About</h2>
      <p>
        Radiation Monitor — a real-time radiation tracking dashboard built on a
        Kafka &rarr; Flink streaming pipeline, using the Safecast dataset.
      </p>
      <p>Big Data Lab Project &mdash; Topic C.</p>

      <h3 style={{ marginTop: "20px" }}>Team</h3>
      <ul style={{ lineHeight: 1.8 }}>
        <li>Ayush Parab</li>
        <li>Chanakya</li>
        <li>Moniya</li>
        <li>Mrudhula</li>
        <li>Roshan Srinivasan</li>
        <li>Roshin Roy</li>
      </ul>
    </div>
  );
}