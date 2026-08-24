const StatsCards = ({ stats, loading }) => {
  const cards = [
    { label: 'Total Items', value: stats.totalItems },
    { label: 'Total Sales', value: stats.totalSales },
    { label: 'Revenue', value: `KES ${stats.totalRevenue.toLocaleString()}` },
    { label: 'Stock Value', value: `KES ${stats.stockValue.toLocaleString()}` },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, index) => (
        <div
          key={index}
          className="bg-white p-4 rounded-lg shadow-sm border border-gray-100"
        >
          <p className="text-sm text-gray-500">{card.label}</p>
          {loading ? (
            <div className="h-8 w-20 bg-gray-200 animate-pulse rounded mt-1"></div>
          ) : (
            <p className="text-2xl font-bold text-[#1a2a4a]">{card.value}</p>
          )}
        </div>
      ))}
    </div>
  );
};

export default StatsCards;