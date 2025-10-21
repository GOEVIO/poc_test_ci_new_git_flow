module.exports = {
    parseAddressStreetToString: (address) => parseAddressStreetToString(address),
    parseAddressToString: (address) => parseAddressToString(address),
    parseAddressOrCountryToString: (address) => parseAddressOrCountryToString(address)
};

function parseAddressStreetToString(address) {
    let addresString = "";

    if (address.address && address.address !== '') {
        addresString += address.address;
    }
    else {
        if (address.street && address.street !== '') {
            addresString += address.street;
        }

        if (address.number && address.number !== '') {
            addresString += ", " + address.number;

            if (address.floor && address.floor !== '') {
                addresString += " - " + address.floor;
            }
        }
    }

    return addresString
}

function parseAddressToString(address) {
    let addresString = "";

    if (address.address && address.address !== '') {
        addresString += address.address;
    }
    else {
        if (address.street && address.street !== '') {
            addresString += address.street;
        }

        if (address.number && address.number !== '') {
            addresString += ", " + address.number;

            if (address.floor && address.floor !== '') {
                addresString += " - " + address.floor;
            }
        }
    }

    if (address.postCode
        && address.postCode !== '') {
        addresString += " " + address.postCode;
    }
    
    if (address.zipCode
        && address.zipCode !== '') {
        addresString += " " + address.zipCode;
    } 

    if (address.state
        && address.state !== '') {
        addresString += " " + address.state;
    }

    if (address.postCode
        && address.postCode !== '') {
        addresString += " " + address.postCode;
    }

    if (address.country
        && address.country !== '') {
        addresString += " " + address.country;
    }

    return addresString
}

function parseAddressOrCountryToString(address) {
    let addresString = "";

    if (address.address
        && address.address !== '') {
        addresString += address.address;
    }
    else {
        if (address.street
            && address.street !== '') {
            addresString += address.street;
        }
        else if (address.city)
            addresString += address.city

        if (address.number
            && address.number !== '') {
            addresString += ", " + address.number;

            if (address.floor
                && address.floor !== '') {
                addresString += " - " + address.floor;
            }
        } else if (address.country)
            addresString += " " + address.country
    }

    return addresString
}