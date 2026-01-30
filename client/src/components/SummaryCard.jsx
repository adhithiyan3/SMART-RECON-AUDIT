export default function SummaryCard({ title, value, color = 'blue' }) {
  return (
    <div className="bg-white p-5 rounded shadow border-l-4 border-blue-500">
      <h3 className="text-gray-500 text-sm">{title}</h3>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </div>
  );
}
