package com.pace2020.epace.sdk.util;

/**
 * Created by IntelliJ IDEA. User: jduval Date: Feb 2, 2005 Time: 1:12:24 PM
 */
public class Version extends SecuredWSDLClient
{
    private String m_version;

    public Version()
    {
        super();

        setVersion();
    }

    public String getVersion()
    {
        return m_version;
    }

    private String setVersion()
    {

        try
        {
            if( null != m_version )
            {
                m_version = getVersionPortType().getVersion();
            }

            return m_version;
        }
        catch( Exception e )
        {
            throw new RuntimeException( "Remote exception getting version", e );
        }
    }
}
