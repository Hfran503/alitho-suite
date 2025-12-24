/**
 *
 */
package com.pace2020.epace.sdk.util;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.rmi.RemoteException;
import java.util.List;

import org.apache.commons.codec.binary.Base64;

import com.pace2020.appbox.services.rpc.Attachment;

/**
 * @author sachindr This sample shows the usage of the AttachmentService api.
 */
public class AttachmentService extends SecuredWSDLClient
{
    public static String addAttachment( String attachmentFileName, String mimeType, String baseObject,
                                        String primaryKey,
                                        String attribute ) throws IOException
    {
        final File attachmentFile = new File( attachmentFileName );
        if( attachmentFile.exists() && attachmentFile.isFile() && attachmentFile.canRead() )
        {
            final byte[] content = getFileBytes( attachmentFile );
            final String attFileName = attachmentFile.getName();
            int index = attFileName.lastIndexOf( '.' );

            final String fileName = index == -1 ? attFileName : attFileName.substring( 0, index );
            final String extension = index == -1 ? "" : attFileName.substring( index + 1 );

            final Attachment attachment = new Attachment();

            attachment.setContent( new String( Base64.encodeBase64( content ) ) );
            attachment.setFileExtension( extension );
            attachment.setMimeType( mimeType );
            attachment.setName( fileName );

            // trying to set attachment
            final String newKey = ClientServices.getAttachmentServicePortType().addAttachment( baseObject, primaryKey, attribute, attachment );

            // retrieve this attachment back
            final Attachment attachmentFromService = ClientServices.getAttachmentServicePortType().getAttachmentFromKey( newKey );

            assert attachment.getContent().equals( attachmentFromService.getContent() );

            return newKey;
        }
        return null;
    }

    public static void removeAllAttachments( String baseObject, String primaryKey, String attribute )
        throws RemoteException
    {
        // trying to remove an attachment
        ClientServices.getAttachmentServicePortType().removeAllAttachments( baseObject, primaryKey, attribute );
    }

    public static void removeAttachment( String attachmentKey ) throws RemoteException
    {
        // trying to remove an attachment
        ClientServices.getAttachmentServicePortType().removeAttachmentFromKey( attachmentKey );
    }

    public static List<Attachment> getAllAttachments( String baseObject, String primaryKey, String attribute )
        throws RemoteException
    {
        return ClientServices.getAttachmentServicePortType().getAllAttachments( baseObject, primaryKey, attribute ).getAttachment();
    }

    private static byte[] getFileBytes( final File attachmentFile ) throws IOException
    {
        final int DEFAULT_BUFFER_SIZE = 1024 * 4;

        FileInputStream input = null;

        final ByteArrayOutputStream output = new ByteArrayOutputStream();
        try
        {
            input = new FileInputStream( attachmentFile );
            final byte[] buffer = new byte[DEFAULT_BUFFER_SIZE];

            int n = 0;
            while( -1 != ( n = input.read( buffer ) ) )
            {
                output.write( buffer, 0, n );
            }
        }
        finally
        {
            if( null != input )
            {
                input.close();
            }
        }
        return output.toByteArray();
    }

    public static void main( String[] args ) throws Exception
    {
        final String option = args.length > 0 ? args[0] : null;
        if( null == option || ( "add".equalsIgnoreCase( option ) && args.length < 5 )
            || ( "remove".equalsIgnoreCase( option ) && args.length < 2 ) )
        {
            System.out.println( "Usage:-" );
            System.out.println(
                "java com.pace2020.epace.sdk.util.AttachmentService add <attachment file> <mime type> <base object> <primary key> <field name>" );
            System.out.println(
                "java com.pace2020.epace.sdk.util.AttachmentService remove <base object> <primary key> <field name>" );
            System.out.println( "java com.pace2020.epace.sdk.util.AttachmentService remove <attachment key>" );
            return;
        }

        if( "add".equalsIgnoreCase( option ) )
        {
            final String attribute = args.length > 5 ? args[5] : null;

            System.out.println( "Trying to set attachment on " + args[3] + "[" + args[4] + "]"
                                    + ( null != attribute ? "." + attribute : "" ) );

            String newKey = addAttachment( args[1], args[2], args[3], args[4], attribute );

            System.out.println( "Attachment[" + newKey + "] added to " + args[3] + "[" + args[4] + "]"
                                    + ( null != attribute ? "." + attribute : "" ) );

            final List<Attachment> attachments = getAllAttachments( args[3], args[4], attribute );
            int count = null != attachments ? attachments.size() : 0;

            System.out.println( args[3] + "[" + args[4] + "]"
                                    + ( null != attribute ? "." + attribute : "" )
                                    + " contains " + count + " attachments." );
        }
        else if( "remove".equalsIgnoreCase( option ) )
        {
            if( args.length > 2 )
            {
                System.out.println( "Trying to remove all attachments on " + args[1] + "[" + args[2] + "]"
                                        + ( args.length > 3 ? "." + args[3] : "" ) );

                removeAllAttachments( args[1], args[2], args.length > 3 ? args[3] : null );

                System.out.println( "Attachments successfully removed." );
            }
            else
            {
                System.out.println( "Trying to remove attachment with key " + args[1] );

                removeAttachment( args[1] );

                System.out.println( "Attachment successfully removed." );
            }
        }
    }
}