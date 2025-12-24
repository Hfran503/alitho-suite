package com.pace2020.epace.sdk.util;

/**
 * Created by IntelliJ IDEA. User: jduval Date: Feb 2, 2005 Time: 12:53:00 PM
 */
public class DeleteObject extends SecuredWSDLClient
{
    private final String m_object;
    private final String m_key;

    public DeleteObject( String key, String object )
    {
        super();

        m_key = key;
        m_object = object;
    }

    public String getKey()
    {
        return m_key;
    }

    public String getObject()
    {
        return m_object;
    }

    public void run()
    {
        try
        {
            getDeleteObjectPortType().deleteObject( getObject(), getKey() );

            System.out.println( getObject() + " " + getKey() + " deleted" );
        }
        catch( Exception e )
        {
            throw new RuntimeException( "Service exception deleting " + getObject() + " " + getKey(), e );
        }
    }
}
