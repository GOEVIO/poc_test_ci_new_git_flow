const axios = require("axios");

async function getTeslaTariff() {
	const context = "Function getTeslaTariff";
	const proxy = process.env.TarriffServiceHost + process.env.PathTeslaTariff;
	const params = { active: true };

	try {
		const result = await axios.get(proxy, { params });
		return result.data || { uom: "KWh", value: 0.262 };
	} catch (error) {
		console.error(`[${context}] [${proxy}] Error `, error.message);
		return { uom: "KWh", value: 0.262 };
	}
}

function getTariffFromPlug(plug, myCSGroups) {
	var context = "Function getTariffFromPlug";
	return new Promise((resolve, reject) => {

		var tariffs = [];
		Promise.all(
			myCSGroups.map(group => {
				return new Promise((resolve, reject) => {

					var tariff = plug.tariff.find(tariff => {

						return tariff.groupId === group.groupId && tariff.tariffId != "";
					});

					if (tariff) {
						tariffs.push(tariff);
						resolve(true);
					}
					else {
						resolve(false);
					};

				});
			})
		).then(() => {

			resolve(tariffs);

		}).catch((error) => {

			console.log(`[${context}] Error `, error.message);
			reject(error);

		});

	});
};

function getTariff(tariffId) {
	var context = "Function getTimeToValidatePayment";
	return new Promise(async (resolve, reject) => {
		try {

			if (tariffId === '-1') {
				resolve('-1');
			}
			else {

				var proxyTariff = process.env.HostTariff + process.env.PathGetTariff;

				var params = {
					_id: tariffId
				};

				axios.get(proxyTariff, { params })
					.then((result) => {

						if (result.data.auth === undefined) {

							resolve(result.data);

						}
						else {

							resolve('-1');

						};

					})
					.catch((error) => {
						console.log(`[${context}] Error `, error.message);
						reject(error);
					});

			};

		} catch (error) {
			console.log(`[${context}] Error `, error.message);
			reject(error);
		};
	});
};

module.exports = {
    getTeslaTariff,
    getTariffFromPlug,
    getTariff
};