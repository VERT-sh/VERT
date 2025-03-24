export const load = () => {
	const isAprilFools =
		new Date().getDate() === 1 && new Date().getMonth() === 3;
	return { isAprilFools };
};
