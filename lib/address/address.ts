import type {AddressType} from "../enums.js"
import {isNullOrWhiteSpace} from "../utils/utils.js"

export class Address {
    readonly addressType: AddressType
    readonly email: string
    readonly displayName: string

    constructor(email: string, displayName: string, addressType: AddressType = "SMTP") {
        this.email = email
        this.displayName = isNullOrWhiteSpace(displayName) ? email : displayName
        this.addressType = addressType
    }
}