export default function DashboardPage() {
    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Teams</h3>
                    <p className="text-3xl font-bold text-indigo-600">0</p>
                    <p className="text-sm text-gray-500 mt-2">Active teams</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Users</h3>
                    <p className="text-3xl font-bold text-purple-600">0</p>
                    <p className="text-sm text-gray-500 mt-2">Team members</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Talents</h3>
                    <p className="text-3xl font-bold text-green-600">34</p>
                    <p className="text-sm text-gray-500 mt-2">CliftonStrengths</p>
                </div>
            </div>
        </div>
    );
}
