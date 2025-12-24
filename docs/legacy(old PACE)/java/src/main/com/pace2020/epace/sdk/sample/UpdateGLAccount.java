package com.pace2020.epace.sdk.sample;

import java.rmi.RemoteException;
import javax.xml.datatype.DatatypeConfigurationException;

import com.pace2020.epace.object.GLAccount;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;

public class UpdateGLAccount extends SecuredWSDLClient
{
    private final GLAccount m_glAccount;

    public UpdateGLAccount( final String glAccount ) throws RemoteException
    {
        super();

        final ReadGLAccount readAcct = new ReadGLAccount( glAccount );
        m_glAccount = readAcct.run();
    }

    public UpdateGLAccount( final GLAccount glAccount )
    {
        super();

        m_glAccount = glAccount;
    }

    public static void main( final String[] args ) throws Exception
    {
        //Check to make sure we have 1 parameters passed in
        if( args.length != 1 )
        {
            throw new Exception( "Usage: UpdateGLAccount <glaccount>" );
        }
        else
        {
            final UpdateGLAccount updateAccount = new UpdateGLAccount( args[0] );
            updateAccount.run( "TEST SET NAME" );
        }
    }

    public GLAccount run( String name ) throws DatatypeConfigurationException
    {
        GLAccount acct = m_glAccount;
        acct.setName( name );
        getUpdateObjectPortType().updateGLAccount( acct );
        return acct;
    }
}
