export async function dispatchAfterRefresh(
	refresh,
	dispatch,
	onRefreshError = () => {},
) {
	try {
		await refresh();
	} catch (error) {
		try {
			onRefreshError(error);
		} catch {
			// Reporting a dashboard refresh failure must not block the action.
		}
	}
	return dispatch();
}
