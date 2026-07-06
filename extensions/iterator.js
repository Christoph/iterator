const COMMANDS = [
	{
		name: "iterator",
		description:
			"Open the iterator dashboard — the control plane for the plan → chunk → implement → review flow.",
	},
	{
		name: "iterator-plan",
		description: "Create or revise the plan in the memory/ OKF bundle.",
	},
	{
		name: "iterator-chunk",
		description:
			"Break the approved plan into small, dependency-ordered chunks.",
	},
	{
		name: "iterator-test",
		description:
			"Write red (pre-implementation) or green tests for a chunk.",
	},
	{
		name: "iterator-implement",
		description:
			"Implement the next dependency-ready chunk and drive its tests green.",
	},
	{
		name: "iterator-review",
		description: "Review a chunk's diff and record the outcome.",
	},
];

export default function iteratorExtension(pi) {
	for (const command of COMMANDS) {
		pi.registerCommand(command.name, {
			description: command.description,
			handler: async (args = "") => {
				const trimmedArgs = args.trim();
				pi.sendUserMessage(
					`/skill:${command.name}${trimmedArgs ? ` ${trimmedArgs}` : ""}`,
				);
			},
		});
	}
}
