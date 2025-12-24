package com.pace2020.epace.sdk.sample;

import java.rmi.RemoteException;
import javax.xml.datatype.DatatypeConfigurationException;

import com.pace2020.epace.object.JobShipment;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;

public class UpdateJobShipment extends SecuredWSDLClient
{
    private final JobShipment m_js;

    public UpdateJobShipment( final String id ) throws RemoteException
    {
        super();

        final ReadJobShipment readAcct = new ReadJobShipment( id );
        m_js = readAcct.run();
    }

    public UpdateJobShipment( final JobShipment id )
    {
        super();
        m_js = id;
    }

    public static void main( final String[] args ) throws Exception
    {
        //Check to make sure we have 1 parameters passed in
        if( args.length != 1 )
        {
            throw new Exception( "Usage: UpdateJobShipment <id>" );
        }
        else
        {
            final UpdateJobShipment updateJS = new UpdateJobShipment( args[0] );
            updateJS.run( "TEST SET NAME" );
        }
    }

    public JobShipment run( String name ) throws DatatypeConfigurationException
    {
        JobShipment js = m_js;
        js.setName( name );
        getUpdateObjectPortType().updateJobShipment( js );
        return js;
    }
}