package com.pace2020.epace.sdk.sample;

import java.util.Set;
import javax.xml.namespace.QName;
import javax.xml.soap.SOAPElement;
import javax.xml.soap.SOAPEnvelope;
import javax.xml.soap.SOAPHeader;
import javax.xml.ws.handler.MessageContext;
import javax.xml.ws.handler.soap.SOAPHandler;
import javax.xml.ws.handler.soap.SOAPMessageContext;

/**
 * @author <a href="mailto:nikhil.walvekar@efi.com">nikhil walvekar</a>
 */
public class StartTransactionHandler implements SOAPHandler<SOAPMessageContext> {
@Override
public boolean handleMessage( SOAPMessageContext smc )
{
	final Boolean outboundProperty = (Boolean) smc.get(MessageContext.MESSAGE_OUTBOUND_PROPERTY);
	if (outboundProperty.booleanValue()) 
	{
        try 
        {
            SOAPEnvelope envelope = smc.getMessage().getSOAPPart().getEnvelope();
            SOAPHeader header = null == envelope.getHeader() ? envelope.addHeader() : envelope.getHeader();
            
            SOAPElement process = header.addChildElement( new QName("transaction", "process") );
            process.addTextNode("startTransaction");
        } 
        catch (Exception e) 
        {
            e.printStackTrace();
        }

    } 
return true;
}

@Override
public void close(MessageContext arg0) {
	// TODO Auto-generated method stub
	
}

@Override
public boolean handleFault(SOAPMessageContext arg0) {
	// TODO Auto-generated method stub
	return false;
}

@Override
public Set<QName> getHeaders() {
	// TODO Auto-generated method stub
	return null;
}
}
