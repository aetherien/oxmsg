import {Address} from "./address.js"
import type {AddressType} from "../enums.js"
import {TopLevelProperties} from "../streams/top_level_properties.js"
import {PropertyTags} from "../property_tags.js"

export class Representing extends Address {
    constructor(email: string, displayName: string, addressType: AddressType = "SMTP") {
        super(email, displayName, addressType)
    }

    writeProperties(stream: TopLevelProperties) {
        stream.addProperty(PropertyTags.PR_SENT_REPRESENTING_EMAIL_ADDRESS_W, this.email)
        stream.addProperty(PropertyTags.PR_SENT_REPRESENTING_NAME_W, this.displayName)
        stream.addProperty(PropertyTags.PR_SENT_REPRESENTING_ADDRTYPE_W, this.addressType)
    }
}