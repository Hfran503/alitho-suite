package com.pace2020.epace.sdk.util;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import javax.xml.namespace.QName;
import javax.xml.ws.handler.soap.SOAPHandler;
import javax.xml.ws.handler.soap.SOAPMessageContext;

public class JaxWSInterceptor implements SOAPHandler<SOAPMessageContext>
{
    @Override
    public boolean handleMessage( SOAPMessageContext c )
    {
        if( (Boolean)c.get( javax.xml.ws.handler.MessageContext.MESSAGE_OUTBOUND_PROPERTY ) )
        {
            Map<String, List<String>> headers = new HashMap<String, List<String>>();
            List<String> list = new ArrayList<String>();
            list = new ArrayList<String>();

            /*list.add( "Basic " + new String( org.apache.commons.codec.binary.Base64
                                                 .encodeBase64( ( System.getProperty( "epace.username" ) + System
                                                     .getProperty( "epace.password" ) ).getBytes() ) ) );
            headers.put( "Authorization", list );*/
            c.put( SOAPMessageContext.HTTP_REQUEST_HEADERS, headers );
        }
        return true;
    }

    @Override
    public void close( javax.xml.ws.handler.MessageContext context )
    {

    }

    @Override
    public boolean handleFault( SOAPMessageContext context )
    {
        return false;
    }

    @Override
    public Set<QName> getHeaders()
    {
        return null;
    }

}