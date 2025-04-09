
# KeyTeleport.com Website

This is a single-page website that provides a means for a link pushed over NFC
to give you a BBQr for easy scanning at a latter time or place.

It's helpful on your [COLDCARD Q](https://store.coinkite.com/store/category/coldcard-q)
when moving secrets via the [Key Teleport feature](https://github.com/Coldcard/firmware/blob/master/docs/key-teleport.md)

Here's an [example BBQr](https://keyteleport.com/#B$2R0100VHT2AGUUH7KUZUUSTOWOIWHJX3XM7GA2N4BHQOXDFHXLVHVA7K6ZO) 

## Technical Design

In order to "teleport" the contents of a QR code over NFC, we will publish a static website directly from an open Github repository. The single-page website contains javascript code which looks at the "hash" part of the incoming URL (window.location.hash) and if it meets the requirements, renders a large QR. The QR data must look like a correctly-encoded BBQr with one of the 3 type-codes above (R S or E). Otherwise the website could render any QR, which we don't want to support.

The page will offer "copy to clipboard" features for the data inside the QR as a URL (ie. same URL as shown) and as an image and of course, the COLDCARD Q can scan from the web browser screen itself.

When the BBQr data is larger than comfortable for a single QR, the website can split into a multi-frame BBQr. The website can do this without understanding the contents of the BBQr data (all of which is encrypted). Download options will be provided for single-frame QR, animated PNG, and "stacked BBQr" (a single tall PNG with each QR frame stacked).

On the COLDCARD side, when NFC is tapped, it will offer a long URL to this site with the data to be transferred "after the hash". This is optional since the QR can be shown on the Q itself, and would pass the same data.

Since the website is running on Github, Coinkite does not have access to IP addresses or other access log details. Because the data for teleport is "after the hash" it is never sent to Github's servers but remains in the browser only. All JS resources referenced by the webpage will have content hashes applied to prevent interference, and the site will be served over SSL.




