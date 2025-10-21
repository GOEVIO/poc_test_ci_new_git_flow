"use strict"
// const fs = require("fs");
// const rawdata = fs.readFileSync("../digitCalculation/lists.json");
// const lists = JSON.parse(rawdata);
// This is the main function where we provide the inputString
// const inputString = "PTEVIC1234567A"
// checkDigitMobility(inputString);


function checkDigitMobilityOLD(inputString, lists) {

	try {
		// Function to validate the input string (alphanumeric string with length 14)
		let isValid = validateInputString(inputString)

		if (isValid) {
			// Inputs from our JSON 
			const listsAlpha = lists.listsAlpha;
			const matrices = adaptMatrix(lists.matrices, inputString);
			const modulosArray = lists.modulosArray;
			const listNumber = lists.listNumber;

			//  Calculations
			let listsAlphaArray = getListsAlphaArray(inputString, listsAlpha);
			let foldingsArray = getFoldingsArray(listsAlphaArray, matrices, modulosArray);

			// // Output
			let checkDigit = getCheckDigit(foldingsArray, listNumber)
			let outputString = getOutputString(inputString, checkDigit)

			// console.log()
			// console.log("inputString  ----->  " , inputString)
			// console.log()
			// console.log("checkDigit   ----->  " , checkDigit)
			// console.log()
			// console.log("outputString ----->  " , outputString)

			return checkDigit

		} else {
			throw new UserException('The input string provided is invalid');
		}
	} catch (error) {
		console.log("Error", error)
	}


}


function checkDigitMobility(inputString, lists) {

	try {


		// Function to validate the input string (alphanumeric string with length 14)
		let isValid = validateInputString(inputString)

		if (isValid) {
			// Inputs from our JSON 
			const listsAlpha = lists.listsAlpha;
			//const matrices = adaptMatrix(lists.matrices , inputString);
			const modulosArray = lists.modulosArray;
			const listNumber = lists.listNumber;

			//  Calculations
			let listsAlphaArray = getListsAlphaArray(inputString, listsAlpha);
			let foldingsArray = getFoldingsArray(listsAlphaArray, lists.matrices, modulosArray);

			// // Output
			let checkDigit = getCheckDigit(foldingsArray, listNumber)
			let outputString = getOutputString(inputString,checkDigit)

			// console.log()
			// console.log("inputString  ----->  " , inputString)
			// console.log()
			// console.log("checkDigit   ----->  " , checkDigit)
			// console.log()
			// console.log("outputString ----->  " , outputString)

			return checkDigit

		} else {
			throw new UserException('The input string provided is invalid');
		}
	} catch (error) {
		console.log("Error", error)
	}


}



function UserException(message) {
	this.message = message;
	this.name = 'UserException';
}

function validateInputString(inputString) {
	let regex = /^[A-Z0-9]*$/
	if (typeof inputString === 'string'
		&& regex.test(inputString)
		&& inputString.length === 14) {
		return true
	} else {
		return false
	}
}

function getListsAlphaArray(inputString, listsAlpha) {
	/*
		Here, each character of the input string is associated with each alpha list. 
		In this algorithm we have 4 alpha lists ( q1, q2 ,r1, r2), so we'll have
		( 4 * inputString.length ) values in total. 
		For each character I separated the q lists from the r lists to help me in
		some functions ahead.
	*/
	let listsAlphaArray = [];
	for (const character of inputString) {
		let characterArray = [];
		for (let key in listsAlpha) {
			let keyArray = [];
			listsAlpha[key].forEach((element) => {
				keyArray.push(element[character]);
			});
			characterArray.push(keyArray);
		}
		listsAlphaArray.push(characterArray);
	}
	return listsAlphaArray;
}

function getFoldingsArray(listsAlphaArray, matrices, modulosArray) {
	/*
		In this piece of code I calculate an array I called foldingsArray. 
		I grab the values of the listsAlphaArray and multiply them with their corresponding values 
		in the matrix. I do this for each character in each alpha list and sum them all, 
		wich results in an array of length 4.
	*/
	let foldingsLength = listsAlphaArray[0].reduce((acc, element) => acc + element.length, 0);
	let foldingsArray = new Array(foldingsLength).fill(0);
	for (let listAlphaIndex = 0; listAlphaIndex < listsAlphaArray.length; listAlphaIndex++) {
		let characterArray = listsAlphaArray[listAlphaIndex];
		let matrixArray = matrices[listAlphaIndex];
		for (let index = 0; index < characterArray.length; index++) {
			let characterArrayI = characterArray[index];
			let matrixArrayI = matrixArray[index];
			let characterArrayILen = characterArrayI.length;

			for (let j = 0; j < characterArrayILen; j++) {
				let sum = 0;
				for (let i = 0; i < characterArrayILen; i++) {
					sum += characterArrayI[i] * matrixArrayI[j + i * characterArrayILen];
				}
				foldingsArray[characterArrayILen * index + j] += sum;
			}
		}
	}
	/*
		In the end we need to divide our folding values for pre-defined values and
		get the remainder value of this operation. 
	*/
	return getRemainder(foldingsArray, modulosArray);
}

function getRemainder(array, modulosArray) {
	return modulosArray.map((element, index) => {
		return array[index] % element;
	});
}

function getCheckDigit(foldingsArray, listNumber) {

	/*
		In this section we couldn't be more generic than this. 
		We had to make different if else statements to get 4 different values 
		I called q1, q2, q3 ,q4. 
	*/

	let q1, q2, r1, r2;
	// Get q1

	q1 = getqValue(foldingsArray, 0);

	// Get q2

	q2 = getqValue(foldingsArray, 1);

	// Get r1

	r1 = getr1(foldingsArray);

	// Get r2

	r2 = getr2(foldingsArray, r1)

	let reverse = getReverse(q1, q2, r1, r2)

	let checkDigit = listNumber[reverse]

	return checkDigit
}

function getqValue(foldingsArray, index) {
	if (foldingsArray[index] == 0) {
		return 0;
	} else if (foldingsArray[index] == 1) {
		return 1;
	} else {
		return null;
	}
}

function getr1(foldingsArray) {
	if (foldingsArray[3] == 0) {
		return 0;
	} else if (foldingsArray[3] == 1) {
		return 2;
	} else if (foldingsArray[3] == 2) {
		return 1;
	} else {
		return null;
	}
}

function getr2(foldingsArray, r1) {
	if (foldingsArray[2] + r1 == 0) {
		return 0;
	} else if (foldingsArray[2] + r1 == 1) {
		return 2;
	} else if (foldingsArray[2] + r1 == 2) {
		return 1;
	} else if (foldingsArray[2] + r1 == 3) {
		return 0;
	} else if (foldingsArray[2] + r1 == 4) {
		return 2;
	} else {
		return null;
	}
}

function getReverse(q1, q2, r1, r2) {
	return q1 + q2 * 2 + r1 * 2 ** 2 + r2 * 2 ** 4
}

function getOutputString(inputString, checkDigit) {
	return inputString + checkDigit
}

function adaptMatrix(matrices, inputString) {
	/* 
	I'm actually being redundant here because we supposedly don't accept input strings
	 different than length 14, so we don't actually need to make a bigger matrix. 
	 But if we eventually accept bigger strings, it works.
	*/

	let addingRows = Math.abs(16 - matrices.length)

	if (addingRows) {
		for (let nRow = 0; nRow < addingRows; nRow++) {
			matrices.push([
				[
					(matrices[0][0][0] * matrices[matrices.length - 1][0][0] + matrices[0][0][1] * matrices[matrices.length - 1][0][2]) % 2,
					(matrices[0][0][0] * matrices[matrices.length - 1][0][1] + matrices[0][0][1] * matrices[matrices.length - 1][0][3]) % 2,
					(matrices[0][0][2] * matrices[matrices.length - 1][0][0] + matrices[0][0][3] * matrices[matrices.length - 1][0][2]) % 2,
					(matrices[0][0][2] * matrices[matrices.length - 1][0][1] + matrices[0][0][3] * matrices[matrices.length - 1][0][3]) % 2,

				],
				[
					(matrices[0][1][0] * matrices[matrices.length - 1][1][0] + matrices[0][1][1] * matrices[matrices.length - 1][1][2]) % 3,
					(matrices[0][1][0] * matrices[matrices.length - 1][1][1] + matrices[0][1][1] * matrices[matrices.length - 1][1][3]) % 3,
					(matrices[0][1][2] * matrices[matrices.length - 1][1][0] + matrices[0][1][3] * matrices[matrices.length - 1][1][2]) % 3,
					(matrices[0][1][2] * matrices[matrices.length - 1][1][1] + matrices[0][1][3] * matrices[matrices.length - 1][1][3]) % 3,

				]
			])
		}
	}

	return matrices
}

module.exports = checkDigitMobility